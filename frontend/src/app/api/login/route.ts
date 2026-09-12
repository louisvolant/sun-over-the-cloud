// src/app/api/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { UsersModel } from '@/lib/models';
import { verifyPassword } from '@/lib/passwordUtils';
import { setSessionUser } from '@/lib/session';
import connectToDatabase from '@/lib/mongoose';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username and password are required' }, { status: 400 });
    }

    await connectToDatabase();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username);
    const user = await UsersModel.findOne(isEmail ? { email: username } : { username });

    if (!user || !(await verifyPassword(password, user.hashed_password))) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    await setSessionUser({
      id: user._id.toString(),
      username: user.username,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
