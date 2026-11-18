// src/app/api/auth/callback/google/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createUser, findUserByEmail, updateUserLastLoginAt } from '@/lib/data';
import { hashPassword } from '@/lib/passwordUtils';
import { setSessionUser } from '@/lib/session';
import {
  isStateMatch,
  OAuthTransaction,
  OAUTH_TX_COOKIE_NAME,
  OAUTH_TX_COOKIE_OPTIONS,
} from '@/lib/oauth';

// Bound the outbound Google calls so a stalled upstream can never make the
// Worker hang.
const OAUTH_TIMEOUT_MS = 10_000;

const generateStrongPassword = () => {
  return (
    crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) +
    crypto.randomInt(1000, 9999)
  );
};

/**
 * Redirect that consumes the one-time transaction cookie, so a callback URL
 * can never be replayed. Reading and clearing through the request/response
 * cookie APIs (rather than `next/headers`) keeps the route testable when
 * invoked directly, with identical behavior in production.
 */
function redirectClearingTx(url: string): NextResponse {
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_TX_COOKIE_NAME, '', {
    ...OAUTH_TX_COOKIE_OPTIONS,
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const frontendUrl = request.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${frontendUrl}?error=missing_code`);
  }

  let tx: OAuthTransaction | null = null;
  try {
    const rawTx = request.cookies.get(OAUTH_TX_COOKIE_NAME)?.value;
    if (rawTx) {
      // Tolerate both raw and percent-encoded cookie values.
      tx = JSON.parse(decodeURIComponent(rawTx)) as OAuthTransaction;
    }
  } catch {
    // An unparsable transaction is the same as no transaction: fail closed.
  }

  // Login CSRF protection: Google must echo the state this browser started
  // the flow with. Anything else (missing cookie, foreign state) is
  // rejected before any outbound call.
  if (!tx || !tx.codeVerifier || !isStateMatch(tx.state, state)) {
    return redirectClearingTx(`${frontendUrl}?error=state_mismatch`);
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: new URL('/api/auth/callback/google', request.url).toString(),
        grant_type: 'authorization_code',
        // PKCE: proves this server initiated the flow and owns the code,
        // even if the authorization code was intercepted on the way back.
        code_verifier: tx.codeVerifier,
      }),
      signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
    });
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);
    const { access_token } = await tokenRes.json() as { access_token: string };

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
    });
    if (!userRes.ok) throw new Error(`Userinfo fetch failed: ${userRes.status}`);
    const { email, verified_email } = await userRes.json() as {
      email: string;
      verified_email?: boolean;
    };

    if (!email) throw new Error('Google userinfo returned no email');
    // Never provision an account from an address Google has not verified:
    // an unverified email could be anyone's claim on that mailbox.
    if (verified_email === false) {
      return redirectClearingTx(`${frontendUrl}?error=email_not_verified`);
    }

    // D1 answers every query at the edge: no connection, no socket, no timeout.
    let userData = await findUserByEmail(email);

    if (!userData) {
      const randomString = crypto.randomBytes(4).toString('hex');
      const username = `user_${randomString}`;
      const randomPassword = generateStrongPassword();
      const hashedPassword = await hashPassword(randomPassword);

      userData = await createUser({ username, email, hashedPassword });
    } else {
      try {
        await updateUserLastLoginAt(userData._id);
      } catch (err) {
        console.warn('Failed to update last_login_at on Google OAuth login:', err);
      }
    }

    await setSessionUser({
      id: userData._id,
      username: userData.username,
    });

    return redirectClearingTx(frontendUrl);
  } catch (error: unknown) {
    console.error('Google OAuth error:', error);
    return redirectClearingTx(`${frontendUrl}?error=oauth_failed`);
  }
}
