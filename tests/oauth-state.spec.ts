import { test, expect } from '@playwright/test';
import { NextRequest } from 'next/server';
import {
  createOAuthTransaction,
  codeChallengeS256,
  buildGoogleAuthUrl,
  isStateMatch,
  OAUTH_TX_COOKIE_NAME,
  OAUTH_TX_MAX_AGE_SEC,
} from '@/lib/oauth';
import { GET as googleLoginRoute } from '@/app/api/auth/google/route';
import { GET as googleCallbackRoute } from '@/app/api/auth/callback/google/route';

test.describe('Google OAuth transaction (state + PKCE)', () => {
  test('creates unique, URL-safe transaction values', () => {
    const first = createOAuthTransaction();
    const second = createOAuthTransaction();

    expect(first.state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.state).not.toBe(second.state);
    expect(first.codeVerifier).not.toBe(second.codeVerifier);
  });

  test('derives the S256 code challenge from the verifier', () => {
    // SHA-256("test-verifier-0123456789") in base64url.
    expect(codeChallengeS256('test-verifier-0123456789')).toBe(
      'W0ydOrGecYPYHAWsrBbwS0ulL-PQuoph-XMZLgSM49Q'
    );
    // Same verifier, same challenge (Google recomputes it on token exchange).
    expect(codeChallengeS256('test-verifier-0123456789')).toBe(
      codeChallengeS256('test-verifier-0123456789')
    );
    // A different verifier must never produce the same challenge.
    expect(codeChallengeS256('another-verifier-9876')).not.toBe(
      codeChallengeS256('test-verifier-0123456789')
    );
  });

  test('builds the Google authorization URL with state and S256 challenge', () => {
    const tx = createOAuthTransaction();
    const url = new URL(
      buildGoogleAuthUrl({
        clientId: 'client-id-123',
        redirectUri: 'https://example.com/api/auth/callback/google',
        tx,
      })
    );

    expect(url.hostname).toBe('accounts.google.com');
    expect(url.pathname).toBe('/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('client-id-123');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe(tx.state);
    expect(url.searchParams.get('code_challenge')).toBe(codeChallengeS256(tx.codeVerifier));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_verifier')).toBeNull(); // never leaked to the browser
  });

  test('state comparison rejects foreign, missing or empty values', () => {
    const tx = createOAuthTransaction();

    expect(isStateMatch(tx.state, tx.state)).toBe(true);
    // The classic login-CSRF attack: Google echoes the attacker's state.
    expect(isStateMatch(tx.state, createOAuthTransaction().state)).toBe(false);
    expect(isStateMatch(tx.state, null)).toBe(false);
    expect(isStateMatch(tx.state, '')).toBe(false);
    expect(isStateMatch(tx.state, tx.state.slice(0, -1))).toBe(false);
    // Fail closed when the cookie never made it back.
    expect(isStateMatch(undefined, 'anything')).toBe(false);
    expect(isStateMatch('', 'anything')).toBe(false);
  });

  test('the transaction cookie has a short lifetime and a dedicated name', () => {
    expect(OAUTH_TX_COOKIE_NAME).toBe('oauth_tx');
    expect(OAUTH_TX_MAX_AGE_SEC).toBe(10 * 60);
  });
});

test.describe('Google login route', () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;

  test.afterEach(() => {
    if (originalClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = originalClientId;
    }
  });

  test('redirects home with an explicit error when Google is not configured', async () => {
    delete process.env.GOOGLE_CLIENT_ID;

    const res = await googleLoginRoute(new NextRequest('http://localhost:3000/api/auth/google'));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get('location')).toBe('http://localhost:3000/?error=oauth_not_configured');
  });

  test('redirects to Google with the transaction bound in an httpOnly cookie', async () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id-123';

    const res = await googleLoginRoute(new NextRequest('http://localhost:3000/api/auth/google'));
    expect(res.status).toBeGreaterThanOrEqual(300);

    const location = new URL(res.headers.get('location') || '');
    expect(location.hostname).toBe('accounts.google.com');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');

    // The transaction cookie carries the state echoed by Google and the
    // PKCE verifier never exposed in the URL.
    const txCookie = res.cookies.get(OAUTH_TX_COOKIE_NAME);
    expect(txCookie).toBeDefined();
    expect(txCookie?.httpOnly).toBe(true);
    expect(txCookie?.maxAge).toBe(OAUTH_TX_MAX_AGE_SEC);

    const tx = JSON.parse(decodeURIComponent(txCookie!.value)) as {
      state: string;
      codeVerifier: string;
    };
    expect(tx.state).toBe(location.searchParams.get('state'));
    expect(tx.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(location.searchParams.get('code_challenge')).toBe(codeChallengeS256(tx.codeVerifier));
  });
});

test.describe('Google callback route (state gate, no upstream calls)', () => {
  test('rejects a callback without a transaction cookie before any upstream call', async () => {
    const res = await googleCallbackRoute(
      new NextRequest('http://localhost:3000/api/auth/callback/google?code=valid_code&state=anything')
    );
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get('location')).toBe('http://localhost:3000/?error=state_mismatch');
  });

  test('rejects a foreign state and consumes the transaction cookie', async () => {
    const tx = createOAuthTransaction();
    const attackerState = createOAuthTransaction().state;
    const res = await googleCallbackRoute(
      new NextRequest(
        `http://localhost:3000/api/auth/callback/google?code=valid_code&state=${encodeURIComponent(attackerState)}`,
        { headers: { Cookie: `${OAUTH_TX_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(tx))}` } }
      )
    );

    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get('location')).toBe('http://localhost:3000/?error=state_mismatch');
    // Single-use: the browser is told to drop the transaction cookie.
    const cleared = res.cookies.get(OAUTH_TX_COOKIE_NAME);
    expect(cleared?.maxAge).toBe(0);
  });
});
