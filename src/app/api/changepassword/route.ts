// src/app/api/changepassword/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { UsersModel } from '@/lib/models';
import { hashPasswordArgon2 } from '@/lib/passwordUtils';
import connectToDatabase, { withDbRetry } from '@/lib/mongoose';
import { withDbTimeout } from '@/lib/timeout';

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized - Please log in first' }, { status: 401 });
  }

  try {
    const { newpassword } = await request.json();
    if (!newpassword || newpassword.length < 6) {
      return NextResponse.json({ success: false, error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    await withDbRetry(() => connectToDatabase());
    const hashedPassword = await hashPasswordArgon2(newpassword);

    const updatedUser = await withDbTimeout(
      UsersModel.findByIdAndUpdate(
        user.id,
        { hashed_password: hashedPassword },
        { new: true }
      )
    );

    if (!updatedUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error changing password:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
