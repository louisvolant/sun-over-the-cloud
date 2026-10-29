// src/app/api/check-auth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, setSessionUser } from '@/lib/session';
import { assertSameOrigin } from '@/lib/origin';

export async function POST(request: NextRequest) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const user = await getSessionUser();
  if (user) {
    // Sliding session: refresh session expiration on app launch / active check
    await setSessionUser(user);
  }
  return NextResponse.json({ isAuthenticated: !!user });
}
