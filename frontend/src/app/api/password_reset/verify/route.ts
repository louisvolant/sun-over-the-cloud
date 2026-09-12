// src/app/api/password_reset/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { UserPasswordResetTokensModel } from '@/lib/models';
import connectToDatabase from '@/lib/mongoose';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const tokenDoc = await UserPasswordResetTokensModel.findOne({ token });

    if (!tokenDoc || new Date(tokenDoc.expires_at) < new Date()) {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error verifying reset token:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
