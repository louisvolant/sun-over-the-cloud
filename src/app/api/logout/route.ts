// src/app/api/logout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';
import { assertSameOrigin } from '@/lib/origin';

export async function POST(request: NextRequest) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  try {
    await clearSession();
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Logout error:', err);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
