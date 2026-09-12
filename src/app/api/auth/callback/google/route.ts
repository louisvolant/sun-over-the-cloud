// src/app/api/auth/callback/google/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
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
  const frontendUrl = process.env.FRONTEND_URL || request.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${frontendUrl}?error=missing_code`);
  }

  try {
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const { access_token } = tokenResponse.data;

    const userInfo = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { email } = userInfo.data;
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
