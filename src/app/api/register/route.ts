// src/app/api/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createUser, findUserByUsernameOrEmail } from '@/lib/data';
import { hashPassword } from '@/lib/passwordUtils';
import { setSessionUser } from '@/lib/session';
import { assertSameOrigin } from '@/lib/origin';
import { isDisallowedEmailDomain, isEmailDomainPolicyBypassed } from '@/lib/emailPolicy';

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
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  try {
    const { username, email, password } = await request.json();

    const validationError = validateInput(username, email, password);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Normalize before the domain policy and the duplicate lookup so casing and
    // surrounding whitespace cannot bypass either check.
    const normalizedEmail = String(email).trim().toLowerCase();

    if (!isEmailDomainPolicyBypassed() && isDisallowedEmailDomain(normalizedEmail)) {
      // Generic message on purpose: do not help bots discover which domains
      // are blocked.
      return NextResponse.json({ error: 'Please use a real email address.' }, { status: 400 });
    }

    const existingUser = await findUserByUsernameOrEmail(username, normalizedEmail);

    if (existingUser) {
      let errorMessage = 'User already exists';
      if (existingUser.username.toLowerCase() === username.toLowerCase()) {
        errorMessage = 'Username already exists';
      } else if (existingUser.email.toLowerCase() === normalizedEmail) {
        errorMessage = 'Email already exists';
      }
      return NextResponse.json({ error: errorMessage }, { status: 409 });
    }

    const hashedPassword = await hashPassword(password);
    const newUser = await createUser({ username, email: normalizedEmail, hashedPassword });

    await setSessionUser({
      id: newUser._id,
      username,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Registration failed:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
