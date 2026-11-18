import { test, expect } from '@playwright/test';
import {
  signPayload,
  verifyToken,
  getSessionSecret,
  SESSION_DURATION_DAYS,
  SESSION_DURATION_SEC,
  SESSION_DURATION_MS,
  REFRESH_THRESHOLD_MS,
  SessionPayload,
} from '@/lib/session';

test.describe('Session and Sliding Authentication', () => {
  test('session duration constants are configured for 30 days', () => {
    expect(SESSION_DURATION_DAYS).toBe(30);
    expect(SESSION_DURATION_SEC).toBe(30 * 24 * 60 * 60);
    expect(SESSION_DURATION_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(REFRESH_THRESHOLD_MS).toBe(24 * 60 * 60 * 1000);
  });

  test('signs and verifies valid 30-day token correctly', () => {
    const now = Date.now();
    const payload: SessionPayload = {
      user: { id: 'user_12345', username: 'testuser' },
      exp: now + SESSION_DURATION_MS,
    };

    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const token = signPayload(payloadStr);

    const verified = verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.user.id).toBe('user_12345');
    expect(verified?.user.username).toBe('testuser');
    expect(verified?.exp).toBeGreaterThan(now + 29 * 24 * 60 * 60 * 1000);
  });

  test('rejects expired tokens', () => {
    const pastTime = Date.now() - 1000;
    const payload: SessionPayload = {
      user: { id: 'user_12345', username: 'testuser' },
      exp: pastTime,
    };

    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const token = signPayload(payloadStr);

    const verified = verifyToken(token);
    expect(verified).toBeNull();
  });

  test('rejects tokens with tampered payload or signature', () => {
    const payload: SessionPayload = {
      user: { id: 'user_12345', username: 'testuser' },
      exp: Date.now() + SESSION_DURATION_MS,
    };

    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const token = signPayload(payloadStr);

    // Tampered payload
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...payload, user: { id: 'hacked_admin', username: 'admin' } })
    ).toString('base64url');
    const signature = token.split('.')[1];
    expect(verifyToken(`${tamperedPayload}.${signature}`)).toBeNull();

    // Tampered signature
    expect(verifyToken(`${payloadStr}.invalidsignature123`)).toBeNull();

    // Invalid format
    expect(verifyToken('invalid_token')).toBeNull();
  });

  test('correctly detects when sliding renewal threshold is reached (> 1 day elapsed)', () => {
    const now = Date.now();

    // Fresh token: issued just now (remaining time ~30 days)
    const freshExp = now + SESSION_DURATION_MS;
    const needsRefreshFresh = freshExp - now < SESSION_DURATION_MS - REFRESH_THRESHOLD_MS;
    expect(needsRefreshFresh).toBe(false);

    // Older token: 2 days have passed (remaining time 28 days < 29 days threshold)
    const twoDaysAgoExp = now + SESSION_DURATION_MS - 2 * 24 * 60 * 60 * 1000;
    const needsRefreshOlder = twoDaysAgoExp - now < SESSION_DURATION_MS - REFRESH_THRESHOLD_MS;
    expect(needsRefreshOlder).toBe(true);
  });
});

test.describe('Session secret configuration (fail closed in production)', () => {
  const originalSecret = process.env.SESSION_COOKIE_KEY;
  const originalNodeEnv = process.env.NODE_ENV;

  test.afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.SESSION_COOKIE_KEY;
    } else {
      process.env.SESSION_COOKIE_KEY = originalSecret;
    }
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('signs and verifies with the configured SESSION_COOKIE_KEY', () => {
    process.env.SESSION_COOKIE_KEY = 'test_secret_key_0123456789abcdef';
    const payloadStr = Buffer.from(
      JSON.stringify({ user: { id: 'user_12345', username: 'testuser' }, exp: Date.now() + 60_000 })
    ).toString('base64url');

    expect(verifyToken(signPayload(payloadStr))?.user.id).toBe('user_12345');
  });

  test('refuses to sign sessions in production when SESSION_COOKIE_KEY is missing', () => {
    delete process.env.SESSION_COOKIE_KEY;
    process.env.NODE_ENV = 'production';

    expect(() => getSessionSecret()).toThrow(/SESSION_COOKIE_KEY/);
  });

  test('outside production, falls back to a random per-process secret instead of a predictable default', () => {
    delete process.env.SESSION_COOKIE_KEY;
    process.env.NODE_ENV = 'development';

    const secret = getSessionSecret();
    expect(secret).not.toBe('default_secret_key_change_me');
    // Stable within the process so dev sessions survive unrelated calls.
    expect(getSessionSecret()).toBe(secret);
  });
});
