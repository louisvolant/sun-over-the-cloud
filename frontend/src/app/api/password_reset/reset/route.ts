// src/app/api/password_reset/reset/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { UsersModel, UserPasswordResetTokensModel } from '@/lib/models';
import { hashPasswordArgon2 } from '@/lib/passwordUtils';
import connectToDatabase from '@/lib/mongoose';

export async function POST(request: NextRequest) {
  try {
    const { token, newpassword } = await request.json();

    if (!token || !newpassword) {
      return NextResponse.json({ success: false, error: 'Token and new password are required' }, { status: 400 });
    }

    await connectToDatabase();
    const tokenDoc = await UserPasswordResetTokensModel.findOne({ token });

    if (!tokenDoc || new Date(tokenDoc.expires_at) < new Date()) {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 400 });
    }

    const hashedPassword = await hashPasswordArgon2(newpassword);

    await UsersModel.findByIdAndUpdate(tokenDoc.user_id, {
      hashed_password: hashedPassword,
    });

    await UserPasswordResetTokensModel.deleteOne({ _id: tokenDoc._id });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in password reset:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
