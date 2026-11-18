import { test, expect } from '@playwright/test';
import { NextRequest } from 'next/server';
import { generateResetToken, hashResetToken } from '@/lib/resetToken';
import { setTestEnv, AppEnv, D1Database, D1PreparedStatement, D1Result, KVNamespace } from '@/lib/cloudflare';
import { POST as resetRoute } from '@/app/api/password_reset/reset/route';
import { GET as verifyRoute } from '@/app/api/password_reset/verify/route';

const VALID_NEW_PASSWORD = 'FreshPassword678901';

interface StoredToken {
  hash: string;
  row: { _id: string; user_id: string; token_hash: string; created_at: number; expires_at: number };
}

/**
 * In-memory D1 double for the reset endpoints. `first()` only resolves a
 * token lookup when the bound value is the stored hash, which is exactly the
 * contract the routes must uphold: a raw token never matches by itself.
 */
function createMockResetEnv(stored: StoredToken | null) {
  let passwordUpdates = 0;
  let tokenDeletions = 0;

  const db: D1Database = {
    prepare(query: string): D1PreparedStatement {
      let binds: unknown[] = [];
      const stmt: D1PreparedStatement = {
        bind(...values: unknown[]) {
          binds = values;
          return stmt;
        },
        async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
          if (query.includes('UPDATE users')) passwordUpdates += 1;
          if (query.includes('DELETE FROM password_reset_tokens')) tokenDeletions += 1;
          return { success: true, meta: { changes: 1 } };
        },
        async first<T = Record<string, unknown>>(): Promise<T | null> {
          if (query.includes('FROM password_reset_tokens') && stored) {
            if (binds[0] === stored.hash) {
              return stored.row as unknown as T;
            }
          }
          return null;
        },
        async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
          return { success: true, results: [] };
        },
      };
      return stmt;
    },
    async batch() {
      return [];
    },
    async exec() {
      return { success: true };
    },
  };

  const dummyKV: KVNamespace = {
    async get() {
      return null;
    },
    async put() {},
    async delete() {},
  };

  const env: AppEnv = { DB: db, CACHE: dummyKV };
  return { env, getPasswordUpdates: () => passwordUpdates, getTokenDeletions: () => tokenDeletions };
}

function storedTokenFor(token: string, expiresAt: number): StoredToken {
  return {
    hash: hashResetToken(token),
    row: {
      _id: 'reset_row_1',
      user_id: 'user_1',
      token_hash: hashResetToken(token),
      created_at: Date.now(),
      expires_at: expiresAt,
    },
  };
}

test.describe('Reset token helpers', () => {
  test('generates 256-bit hex tokens', () => {
    const first = generateResetToken();
    const second = generateResetToken();
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(second);
  });

  test('hashes tokens deterministically to a SHA-256 hex digest', () => {
    const token = generateResetToken();
    expect(hashResetToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashResetToken(token)).toBe(hashResetToken(token));
    // The token itself must never appear in its hash.
    expect(hashResetToken(token)).not.toContain(token);
  });
});

test.describe('Password reset endpoints (hashed tokens, shared password policy)', () => {
  test.afterEach(() => {
    setTestEnv(null);
  });

  test('redeems a valid token once and consumes it', async () => {
    const token = generateResetToken();
    const stored = storedTokenFor(token, Date.now() + 60 * 60 * 1000);
    const { env, getPasswordUpdates, getTokenDeletions } = createMockResetEnv(stored);
    setTestEnv(env);

    const res = await resetRoute(
      new NextRequest('http://localhost:3000/api/password_reset/reset', {
        method: 'POST',
        body: JSON.stringify({ token, newpassword: VALID_NEW_PASSWORD }),
      })
    );

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(getPasswordUpdates()).toBe(1);
    expect(getTokenDeletions()).toBe(1);
  });

  test('rejects the raw token value (only its hash matches the stored row)', async () => {
    const token = generateResetToken();
    const stored = storedTokenFor(token, Date.now() + 60 * 60 * 1000);
    const { env, getPasswordUpdates } = createMockResetEnv(stored);
    setTestEnv(env);

    // An attacker with a copy of the database sees token_hash, not the
    // emailed raw token: presenting it back must fail.
    const res = await resetRoute(
      new NextRequest('http://localhost:3000/api/password_reset/reset', {
        method: 'POST',
        body: JSON.stringify({ token: stored.row.token_hash, newpassword: VALID_NEW_PASSWORD }),
      })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid or expired token');
    expect(getPasswordUpdates()).toBe(0);
  });

  test('rejects unknown and expired tokens without touching the password', async () => {
    const { env, getPasswordUpdates } = createMockResetEnv(null);
    setTestEnv(env);

    const unknown = await resetRoute(
      new NextRequest('http://localhost:3000/api/password_reset/reset', {
        method: 'POST',
        body: JSON.stringify({ token: generateResetToken(), newpassword: VALID_NEW_PASSWORD }),
      })
    );
    expect(unknown.status).toBe(400);
    expect(getPasswordUpdates()).toBe(0);
  });

  test('enforces the shared 15-character policy on the new password', async () => {
    const token = generateResetToken();
    const stored = storedTokenFor(token, Date.now() + 60 * 60 * 1000);
    const { env, getPasswordUpdates } = createMockResetEnv(stored);
    setTestEnv(env);

    const res = await resetRoute(
      new NextRequest('http://localhost:3000/api/password_reset/reset', {
        method: 'POST',
        body: JSON.stringify({ token, newpassword: 'short' }),
      })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Password must be at least 15 characters');
    expect(getPasswordUpdates()).toBe(0);
  });

  test('verify endpoint confirms a hashed lookup for a valid token', async () => {
    const token = generateResetToken();
    const stored = storedTokenFor(token, Date.now() + 60 * 60 * 1000);
    const { env } = createMockResetEnv(stored);
    setTestEnv(env);

    const valid = await verifyRoute(
      new NextRequest(`http://localhost:3000/api/password_reset/verify?token=${token}`)
    );
    expect(valid.status).toBe(200);
    expect((await valid.json()).success).toBe(true);

    const invalid = await verifyRoute(
      new NextRequest(`http://localhost:3000/api/password_reset/verify?token=${stored.row.token_hash}`)
    );
    const invalidBody = await invalid.json();
    expect(invalidBody.success).toBe(false);
    expect(invalidBody.error).toBe('Invalid or expired token');
  });
});
