import { test, expect } from '@playwright/test';
import {
  createUser,
  updateUserLastLoginAt,
  findUserByEmail,
  findUserByUsername,
  findUserByUsernameOrEmail,
  DbUser,
} from '@/lib/data';
import { setTestEnv, AppEnv, D1Database, D1PreparedStatement, D1Result, KVNamespace } from '@/lib/cloudflare';
import { POST as loginRoute } from '@/app/api/login/route';
import { POST as registerRoute } from '@/app/api/register/route';
import { GET as googleCallbackRoute } from '@/app/api/auth/callback/google/route';
import { hashPassword } from '@/lib/passwordUtils';
import { NextRequest } from 'next/server';

interface StoredUser {
  id: string;
  username: string;
  email: string;
  hashed_password: string;
  created_at: number;
  last_login_at: number | null;
}

function createMockD1(options: { simulateUnmigratedSchema?: boolean } = {}) {
  const users = new Map<string, StoredUser>();
  let simulateUnmigrated = options.simulateUnmigratedSchema ?? false;

  const db: D1Database = {
    prepare(query: string): D1PreparedStatement {
      let boundValues: unknown[] = [];

      const stmt: D1PreparedStatement = {
        bind(...values: unknown[]) {
          boundValues = values;
          return stmt;
        },
        async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
          if (query.includes('INSERT INTO users')) {
            if (query.includes('last_login_at')) {
              if (simulateUnmigrated) {
                throw new Error('no such column: last_login_at');
              }
              const [id, username, email, hashedPassword, createdAt, lastLoginAt] = boundValues as [
                string,
                string,
                string,
                string,
                number,
                number,
              ];
              users.set(id, {
                id,
                username,
                email,
                hashed_password: hashedPassword,
                created_at: createdAt,
                last_login_at: lastLoginAt,
              });
              return { success: true, meta: { changes: 1 } };
            } else {
              const [id, username, email, hashedPassword, createdAt] = boundValues as [
                string,
                string,
                string,
                string,
                number,
              ];
              users.set(id, {
                id,
                username,
                email,
                hashed_password: hashedPassword,
                created_at: createdAt,
                last_login_at: null,
              });
              return { success: true, meta: { changes: 1 } };
            }
          }

          if (query.includes('UPDATE users SET last_login_at = ? WHERE id = ?')) {
            if (simulateUnmigrated) {
              throw new Error('no such column: last_login_at');
            }
            const [lastLoginAt, id] = boundValues as [number, string];
            const user = users.get(id);
            if (user) {
              user.last_login_at = lastLoginAt;
              return { success: true, meta: { changes: 1 } };
            }
            return { success: true, meta: { changes: 0 } };
          }

          if (query.includes('DELETE FROM users WHERE id = ?')) {
            const [id] = boundValues as [string];
            users.delete(id);
            return { success: true, meta: { changes: 1 } };
          }

          return { success: true, meta: { changes: 0 } };
        },

        async first<T = Record<string, unknown>>(): Promise<T | null> {
          if (query.includes('FROM users')) {
            if (query.includes('last_login_at') && simulateUnmigrated) {
              throw new Error('no such column: last_login_at');
            }

            let found: StoredUser | undefined;
            if (query.includes('email = ?') && query.includes('username = ?')) {
              const [u, e] = boundValues as [string, string];
              found = Array.from(users.values()).find(
                (item) =>
                  item.username.toLowerCase() === u.toLowerCase() ||
                  item.email.toLowerCase() === e.toLowerCase()
              );
            } else if (query.includes('email = ?')) {
              const [e] = boundValues as [string];
              found = Array.from(users.values()).find(
                (item) => item.email.toLowerCase() === e.toLowerCase()
              );
            } else if (query.includes('username = ?')) {
              const [u] = boundValues as [string];
              found = Array.from(users.values()).find(
                (item) => item.username.toLowerCase() === u.toLowerCase()
              );
            }

            if (!found) return null;

            if (query.includes('last_login_at')) {
              return {
                _id: found.id,
                username: found.username,
                email: found.email,
                hashed_password: found.hashed_password,
                created_at: found.created_at,
                last_login_at: found.last_login_at,
              } as T;
            } else {
              return {
                _id: found.id,
                username: found.username,
                email: found.email,
                hashed_password: found.hashed_password,
                created_at: found.created_at,
              } as T;
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

  const env: AppEnv = {
    DB: db,
    CACHE: dummyKV,
  };

  return {
    env,
    users,
    setSimulateUnmigrated(val: boolean) {
      simulateUnmigrated = val;
    },
  };
}

test.describe('last_login_at tracking in D1', () => {
  test.afterEach(() => {
    setTestEnv(null);
  });

  test('createUser initializes last_login_at equal to created_at as integer Unix ms', async () => {
    const mock = createMockD1();
    setTestEnv(mock.env);

    const before = Date.now();
    const user = await createUser({
      username: 'tracker_user',
      email: 'tracker@example.com',
      hashedPassword: 'pbkdf2$hash123',
    });
    const after = Date.now();

    expect(typeof user.created_at).toBe('number');
    expect(typeof user.last_login_at).toBe('number');
    expect(user.last_login_at).toBe(user.created_at);
    expect(user.created_at).toBeGreaterThanOrEqual(before);
    expect(user.created_at).toBeLessThanOrEqual(after);

    // Verify stored state in D1 mock
    const stored = mock.users.get(user._id);
    expect(stored).toBeDefined();
    expect(stored?.last_login_at).toBe(user.created_at);
  });

  test('createUser falls back smoothly if D1 schema is unmigrated (no last_login_at column)', async () => {
    const mock = createMockD1({ simulateUnmigratedSchema: true });
    setTestEnv(mock.env);

    const user = await createUser({
      username: 'legacy_user',
      email: 'legacy@example.com',
      hashedPassword: 'pbkdf2$hash123',
    });

    expect(user._id).toBeDefined();
    expect(user.username).toBe('legacy_user');
    expect(user.created_at).toBeGreaterThan(0);
  });

  test('updateUserLastLoginAt updates last_login_at with current timestamp', async () => {
    const mock = createMockD1();
    setTestEnv(mock.env);

    const user = await createUser({
      username: 'login_updater',
      email: 'updater@example.com',
      hashedPassword: 'pbkdf2$hash123',
    });

    const initialLoginAt = user.last_login_at;
    const newTimestamp = Date.now() + 5000;

    const updated = await updateUserLastLoginAt(user._id, newTimestamp);
    expect(updated).toBe(true);

    const stored = mock.users.get(user._id);
    expect(stored?.last_login_at).toBe(newTimestamp);
    expect(stored?.last_login_at).not.toBe(initialLoginAt);
  });

  test('updateUserLastLoginAt does not throw when schema is unmigrated', async () => {
    const mock = createMockD1({ simulateUnmigratedSchema: true });
    setTestEnv(mock.env);

    const result = await updateUserLastLoginAt('any_user_id', Date.now());
    expect(result).toBe(false);
  });

  test('findUserByEmail and findUserByUsername return last_login_at', async () => {
    const mock = createMockD1();
    setTestEnv(mock.env);

    const user = await createUser({
      username: 'find_tester',
      email: 'find_tester@example.com',
      hashedPassword: 'pbkdf2$hash123',
    });

    const byEmail = await findUserByEmail('find_tester@example.com');
    expect(byEmail).not.toBeNull();
    expect(byEmail?.last_login_at).toBe(user.last_login_at);

    const byUsername = await findUserByUsername('find_tester');
    expect(byUsername).not.toBeNull();
    expect(byUsername?.last_login_at).toBe(user.last_login_at);

    const byBoth = await findUserByUsernameOrEmail('find_tester', 'find_tester@example.com');
    expect(byBoth).not.toBeNull();
    expect(byBoth?.last_login_at).toBe(user.last_login_at);
  });

  test('findUser fallback on unmigrated schema returns last_login_at as null', async () => {
    const mock = createMockD1();
    // Insert user into mock directly with no last_login_at
    mock.users.set('id_old', {
      id: 'id_old',
      username: 'old_schema_user',
      email: 'old@example.com',
      hashed_password: 'pbkdf2$hash',
      created_at: 1000,
      last_login_at: null,
    });
    mock.setSimulateUnmigrated(true);
    setTestEnv(mock.env);

    const found = await findUserByEmail('old@example.com');
    expect(found).not.toBeNull();
    expect(found?.username).toBe('old_schema_user');
    expect(found?.last_login_at).toBeNull();
  });

  test('POST /api/login updates last_login_at on successful password authentication', async () => {
    const mock = createMockD1();
    setTestEnv(mock.env);

    const rawPassword = 'ValidPassword12345';
    const hashedPassword = await hashPassword(rawPassword);

    const user = await createUser({
      username: 'signin_user',
      email: 'signin@example.com',
      hashedPassword,
    });

    const initialTimestamp = user.last_login_at as number;

    // Small delay to ensure timestamp differs
    await new Promise((r) => setTimeout(r, 20));

    const req = new NextRequest('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        username: 'signin_user',
        password: rawPassword,
      }),
    });

    const res = await loginRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const updatedUser = mock.users.get(user._id);
    expect(updatedUser).toBeDefined();
    expect(updatedUser!.last_login_at).toBeGreaterThan(initialTimestamp);
  });

  test('POST /api/login succeeds even if updating last_login_at fails (unmigrated D1 schema)', async () => {
    const mock = createMockD1();
    setTestEnv(mock.env);

    const rawPassword = 'ValidPassword12345';
    const hashedPassword = await hashPassword(rawPassword);

    const user = await createUser({
      username: 'unmigrated_login_user',
      email: 'unmigrated_login@example.com',
      hashedPassword,
    });

    // Now turn on unmigrated schema simulation
    mock.setSimulateUnmigrated(true);

    const req = new NextRequest('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        username: 'unmigrated_login_user',
        password: rawPassword,
      }),
    });

    const res = await loginRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('POST /api/register creates user with last_login_at initialized', async () => {
    const mock = createMockD1();
    setTestEnv(mock.env);

    const req = new NextRequest('http://localhost:3000/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        username: 'register_test_user',
        email: 'register_test@gmail.com',
        password: 'ValidPassword12345',
      }),
    });

    const res = await registerRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const created = Array.from(mock.users.values()).find(
      (u) => u.username === 'register_test_user'
    );
    expect(created).toBeDefined();
    expect(created!.last_login_at).toBe(created!.created_at);
    expect(typeof created!.last_login_at).toBe('number');
  });

  test('Google OAuth callback: initializes last_login_at for new user, and updates last_login_at for existing user', async () => {
    const mock = createMockD1();
    setTestEnv(mock.env);

    const email = 'oauth_user@example.com';

    // Mock fetch for Google token and userinfo endpoints
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'mock_access_token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('googleapis.com/oauth2/v2/userinfo')) {
        return new Response(JSON.stringify({ email }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      // 1. First OAuth login: User does not exist yet -> should be created with last_login_at = created_at
      const firstReq = new NextRequest('http://localhost:3000/api/auth/callback/google?code=valid_code_1', {
        headers: { Origin: 'http://localhost:3000' },
      });
      const firstRes = await googleCallbackRoute(firstReq);
      expect([302, 307, 308]).toContain(firstRes.status);

      const createdUser = Array.from(mock.users.values()).find((u) => u.email === email);
      expect(createdUser).toBeDefined();
      expect(createdUser!.last_login_at).toBe(createdUser!.created_at);
      const firstLoginAt = createdUser!.last_login_at as number;

      // Small delay
      await new Promise((r) => setTimeout(r, 20));

      // 2. Second OAuth login: User already exists -> should update last_login_at
      const secondReq = new NextRequest('http://localhost:3000/api/auth/callback/google?code=valid_code_2', {
        headers: { Origin: 'http://localhost:3000' },
      });
      const secondRes = await googleCallbackRoute(secondReq);
      expect([302, 307, 308]).toContain(secondRes.status);

      expect(createdUser!.last_login_at).toBeGreaterThan(firstLoginAt);

      // 3. Unmigrated schema simulation: Should not fail callback
      mock.setSimulateUnmigrated(true);
      const thirdReq = new NextRequest('http://localhost:3000/api/auth/callback/google?code=valid_code_3', {
        headers: { Origin: 'http://localhost:3000' },
      });
      const thirdRes = await googleCallbackRoute(thirdReq);
      expect([302, 307, 308]).toContain(thirdRes.status);
      expect(thirdRes.headers.get('location')).toBe('http://localhost:3000/');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
