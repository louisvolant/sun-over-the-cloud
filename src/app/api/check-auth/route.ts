// src/app/api/check-auth/route.ts
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';

export async function POST() {
  const user = await getSessionUser();
  return NextResponse.json({ isAuthenticated: !!user });
}
