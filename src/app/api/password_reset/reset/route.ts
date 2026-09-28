// src/app/api/password_reset/reset/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { deleteResetToken, getResetToken, updateUserPassword } from '@/lib/data';
import { hashPassword } from '@/lib/passwordUtils';

export async function POST(request: NextRequest) {
  try {
    const { token, newpassword } = await request.json();

    if (!token || !newpassword) {
      return NextResponse.json({ success: false, error: 'Token and new password are required' }, { status: 400 });
    }

    const tokenDoc = await getResetToken(token);

    if (!tokenDoc || tokenDoc.expires_at < Date.now()) {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 400 });
    }

    const hashedPassword = await hashPassword(newpassword);

    await updateUserPassword(tokenDoc.user_id, hashedPassword);
    await deleteResetToken(tokenDoc._id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in password reset:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
