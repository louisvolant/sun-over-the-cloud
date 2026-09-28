// src/app/api/remove-favorite/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { deleteFavorite, renumberFavorites } from '@/lib/data';

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing favorite ID' }, { status: 400 });
    }

    const deleted = await deleteFavorite(id, user.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Favorite not found' }, { status: 404 });
    }

    // Keep the order dense (0..n-1) after a removal.
    await renumberFavorites(user.id);

    return NextResponse.json({ message: 'Favorite removed successfully' });
  } catch (err: any) {
    console.error('Error removing favorite:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
