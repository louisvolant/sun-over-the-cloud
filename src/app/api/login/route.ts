// src/app/api/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, findUserByUsername } from '@/lib/data';
import { verifyPassword } from '@/lib/passwordUtils';
import { setSessionUser } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username and password are required' }, { status: 400 });
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username);
    const user = isEmail ? await findUserByEmail(username) : await findUserByUsername(username);

    if (!user || !(await verifyPassword(password, user.hashed_password))) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    await setSessionUser({
      id: user._id,
      username: user.username,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
