// src/app/api/auth/callback/google/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createUser, findUserByEmail } from '@/lib/data';
import { hashPassword } from '@/lib/passwordUtils';
import { setSessionUser } from '@/lib/session';

// Bound the outbound Google calls so a stalled upstream can never make the
// Worker hang.
const OAUTH_TIMEOUT_MS = 10_000;

const generateStrongPassword = () => {
  return (
    crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) +
    crypto.randomInt(1000, 9999)
  );
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const frontendUrl = request.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${frontendUrl}?error=missing_code`);
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
    const { email } = await userRes.json() as { email: string };

    // D1 answers every query at the edge: no connection, no socket, no timeout.
    let userData = await findUserByEmail(email);

    if (!userData) {
      const randomString = crypto.randomBytes(4).toString('hex');
      const username = `user_${randomString}`;
      const randomPassword = generateStrongPassword();
      const hashedPassword = await hashPassword(randomPassword);

      userData = await createUser({ username, email, hashedPassword });
    }

    await setSessionUser({
      id: userData._id,
      username: userData.username,
    });

    return NextResponse.redirect(frontendUrl);
  } catch (error: any) {
    console.error('Google OAuth error:', error);
    return NextResponse.redirect(`${frontendUrl}?error=oauth_failed`);
  }
}
