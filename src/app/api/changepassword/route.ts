// src/app/api/changepassword/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { findUserById, updateUserPassword } from '@/lib/data';
import { hashPassword, verifyPassword } from '@/lib/passwordUtils';
import { validatePasswordStrength } from '@/lib/passwordPolicy';
import { assertSameOrigin } from '@/lib/origin';

export async function POST(request: NextRequest) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized - Please log in first' }, { status: 401 });
  }

  try {
    const { currentpassword, newpassword } = await request.json();

    // Shared policy: the new password must clear the same bar as
    // registration. The previous 6-character minimum let a session holder
    // weaken the account below what the owner originally chose.
    const passwordError = validatePasswordStrength(newpassword);
    if (passwordError) {
      return NextResponse.json({ success: false, error: passwordError }, { status: 400 });
    }

    // Security: the current password must be re-verified, so a stolen or
    // forged session cookie alone can no longer rotate the password and
    // silently lock the account owner out.
    const dbUser = await findUserById(user.id);
    if (!dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const currentProvided = typeof currentpassword === 'string' ? currentpassword : '';
    if (!(await verifyPassword(currentProvided, dbUser.hashed_password))) {
      // Stable error code (not a message) so the frontend can translate it
      // without leaking anything about the stored hash.
      return NextResponse.json({ success: false, error: 'current_password_incorrect' }, { status: 401 });
    }

    const hashedPassword = await hashPassword(newpassword);
    await updateUserPassword(user.id, hashedPassword);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error changing password:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
