// src/app/api/favorites/route.ts
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { listFavorites } from '@/lib/data';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const favorites = await listFavorites(user.id);
    return NextResponse.json(favorites);
  } catch (err: any) {
    console.error('Error fetching favorites:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
