// src/app/api/password_reset/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getResetToken } from '@/lib/data';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 });
  }

  try {
    const tokenDoc = await getResetToken(token);

    if (!tokenDoc || tokenDoc.expires_at < Date.now()) {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error verifying reset token:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
