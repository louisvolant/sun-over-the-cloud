// src/app/api/password_reset/request/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { UsersModel, UserPasswordResetTokensModel } from '@/lib/models';
import connectToDatabase from '@/lib/mongoose';

const MAILJET_API_URL = 'https://api.mailjet.com/v3.1/send';
const EMAIL_TIMEOUT_MS = 10_000;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ success: true });
    }

    // Dev comment: the DB lookup intentionally stays first — checking that the
    // user exists before anything else is what prevents email enumeration.
    // Only the outbound email send below is made best-effort and time-bounded
    // so a Mailjet outage can never hang the request (nor leak the account's
    // existence with a 500).
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
      const frontendUrl = process.env.FRONTEND_URL || request.nextUrl.origin;
      const resetUrl = `${frontendUrl}/passwordrenew?token=${token}`;

      // Use native fetch instead of node-mailjet: the library relies on the
      // Node.js http stack and can hang on Cloudflare Workers (same root cause
      // as the axios hangs already fixed elsewhere). AbortSignal.timeout keeps
      // the call bounded.
      try {
        const response = await fetch(MAILJET_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${process.env.MAILJET_API_KEY}:${process.env.MAILJET_API_SECRET}`
            ).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
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
          }),
          signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
        });

        if (!response.ok) {
          console.error(`Mailjet responded with status ${response.status}`);
        }
      } catch (mailErr: unknown) {
        console.error('Failed to send password reset email:', mailErr instanceof Error ? mailErr.message : mailErr);
      }
    }

    // Always report success even if the email could not be sent, so the
    // endpoint never reveals whether the account exists.
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error in password reset request:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}