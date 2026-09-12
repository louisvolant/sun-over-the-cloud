// src/app/api/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { UsersModel } from '@/lib/models';
import { hashPasswordArgon2 } from '@/lib/passwordUtils';
import { setSessionUser } from '@/lib/session';
import connectToDatabase from '@/lib/mongoose';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateInput = (username?: string, email?: string, password?: string): string | null => {
  if (!username || username.length <= 6) {
    return 'Username must be more than 6 characters';
  }
  if (!email || !emailRegex.test(email)) {
    return 'Email must be a valid email address';
  }
  if (!password || password.length < 15) {
    return 'Password must be at least 15 characters';
  }
  return null;
};

export async function POST(request: NextRequest) {
  try {
    const { username, email, password } = await request.json();

    const validationError = validateInput(username, email, password);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    await connectToDatabase();

    const existingUser = await UsersModel.findOne({
      $or: [
        { username: { $regex: new RegExp(`^${username}$`, 'i') } },
        { email: { $regex: new RegExp(`^${email}$`, 'i') } },
      ],
    });

    if (existingUser) {
      let errorMessage = 'User already exists';
      if (existingUser.username.toLowerCase() === username.toLowerCase()) {
        errorMessage = 'Username already exists';
      } else if (existingUser.email.toLowerCase() === email.toLowerCase()) {
        errorMessage = 'Email already exists';
      }
      return NextResponse.json({ error: errorMessage }, { status: 409 });
    }

    const hashedPassword = await hashPasswordArgon2(password);
    const newUser = new UsersModel({
      username,
      email,
      hashed_password: hashedPassword,
    });

    await newUser.save();

    await setSessionUser({
      id: newUser._id.toString(),
      username,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Registration failed:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
