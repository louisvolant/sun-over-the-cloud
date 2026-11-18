// src/app/api/auth/google/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  buildGoogleAuthUrl,
  createOAuthTransaction,
  OAUTH_TX_COOKIE_NAME,
  OAUTH_TX_COOKIE_OPTIONS,
} from '@/lib/oauth';

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL('/?error=oauth_not_configured', request.url));
  }

  // Bind this authorization attempt to the requesting browser: the callback
  // later rejects any flow whose echoed state was not started here (login
  // CSRF) and completes the token exchange with the PKCE verifier. The
  // transaction is written through the redirect response's own cookie API,
  // which works identically in production and when the route is invoked
  // directly in tests.
  const tx = createOAuthTransaction();
  const redirectUri = new URL('/api/auth/callback/google', request.url).toString();
  const response = NextResponse.redirect(
    buildGoogleAuthUrl({ clientId, redirectUri, tx })
  );
  response.cookies.set(OAUTH_TX_COOKIE_NAME, JSON.stringify(tx), OAUTH_TX_COOKIE_OPTIONS);
  return response;
}
