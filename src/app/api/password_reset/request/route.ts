// src/app/api/password_reset/request/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Mailjet from 'node-mailjet';
import { UsersModel, UserPasswordResetTokensModel } from '@/lib/models';
import connectToDatabase from '@/lib/mongoose';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ success: true });
    }

    await connectToDatabase();
    const user = await UsersModel.findOne({ email });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await UserPasswordResetTokensModel.create({
      user_id: user._id,
      token,
      expires_at: expiresAt,
    });

    if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
      const mailjet = new Mailjet({
        apiKey: process.env.MAILJET_API_KEY,
        apiSecret: process.env.MAILJET_API_SECRET,
      });

      const frontendUrl = process.env.FRONTEND_URL || request.nextUrl.origin;
      const resetUrl = `${frontendUrl}/passwordrenew?token=${token}`;

      await mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [
          {
            From: {
              Email: process.env.MAILJET_SENDER_EMAIL || 'noreply@sunoverthe.cloud',
              Name: 'Sun Over The Cloud',
            },
            To: [{ Email: email }],
            Subject: 'Password Reset Request',
            TextPart: `Click this link to reset your password: ${resetUrl}`,
            HTMLPart: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 24 hours.</p>`,
          },
        ],
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in password reset request:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
