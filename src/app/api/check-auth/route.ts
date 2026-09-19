// src/app/api/check-auth/route.ts
import { NextResponse } from 'next/server';
import { getSessionUser, setSessionUser } from '@/lib/session';

export async function POST() {
  const user = await getSessionUser();
  if (user) {
    // Sliding session: refresh session expiration on app launch / active check
    await setSessionUser(user);
  }
  return NextResponse.json({ isAuthenticated: !!user });
}
