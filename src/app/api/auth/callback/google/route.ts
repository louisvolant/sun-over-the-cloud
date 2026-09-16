// src/app/api/auth/callback/google/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { UsersModel } from '@/lib/models';
import { hashPasswordArgon2 } from '@/lib/passwordUtils';
import { setSessionUser } from '@/lib/session';
import connectToDatabase from '@/lib/mongoose';

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
    });
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);
    const { access_token } = await tokenRes.json() as { access_token: string };

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userRes.ok) throw new Error(`Userinfo fetch failed: ${userRes.status}`);
    const { email } = await userRes.json() as { email: string };
    await connectToDatabase();

    let userData = await UsersModel.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });

    if (!userData) {
      const randomString = crypto.randomBytes(4).toString('hex');
      const username = `user_${randomString}`;
      const randomPassword = generateStrongPassword();
      const hashedPassword = await hashPasswordArgon2(randomPassword);

      userData = new UsersModel({
        username,
        email,
        hashed_password: hashedPassword,
        created_at: new Date(),
      });
      await userData.save();
    }

    await setSessionUser({
      id: userData._id.toString(),
      username: userData.username,
    });

    return NextResponse.redirect(frontendUrl);
  } catch (error: any) {
    console.error('Google OAuth error:', error);
    return NextResponse.redirect(`${frontendUrl}?error=oauth_failed`);
  }
}
