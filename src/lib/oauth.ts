// src/lib/oauth.ts
//
// Google OAuth transaction helpers (login CSRF + PKCE).
//
// The login flow used to redirect to Google without a `state` value and
// without code challenge, so an attacker could initiate a flow with their own
// Google account and trick a victim into completing it — ending up logged in
// as the attacker (login CSRF), with everything the victim then did in the
// app (favorites, saved locations) visible to the attacker.
//
// Each login attempt now creates a one-time transaction:
//   - `state` binds the authorization request to this browser via a
//     short-lived httpOnly cookie and is echoed back by Google;
//   - PKCE (S256) proves ownership of the authorization code during the
//     token exchange, protecting against intercepted codes.
import crypto from 'crypto';

export const OAUTH_TX_COOKIE_NAME = 'oauth_tx';
export const OAUTH_TX_MAX_AGE_SEC = 10 * 60;

/**
 * Transaction cookie attributes. `httpOnly` keeps the verifier out of
 * reach of injected scripts; `SameSite=Lax` survives the top-level
 * redirect back from Google while blocking cross-site subresource sends.
 */
export const OAUTH_TX_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: OAUTH_TX_MAX_AGE_SEC,
} as const;

export interface OAuthTransaction {
  state: string;
  codeVerifier: string;
}

/** Fresh single-use transaction values, URL-safe by construction. */
export function createOAuthTransaction(): OAuthTransaction {
  return {
    state: crypto.randomBytes(16).toString('base64url'),
    codeVerifier: crypto.randomBytes(32).toString('base64url'),
  };
}

/** S256 code challenge: base64url(SHA-256(verifier)). */
export function codeChallengeS256(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function buildGoogleAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  tx: OAuthTransaction;
}): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'email profile');
  url.searchParams.set('state', params.tx.state);
  url.searchParams.set('code_challenge', codeChallengeS256(params.tx.codeVerifier));
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

/**
 * Constant-time comparison of the state Google echoed back against the value
 * bound to this browser. An empty expected state never matches (fail closed).
 */
export function isStateMatch(expected: string | undefined, received: string | null): boolean {
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}
