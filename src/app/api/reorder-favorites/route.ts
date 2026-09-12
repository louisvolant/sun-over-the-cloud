// src/app/api/reorder-favorites/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { UserFavoritesModel } from '@/lib/models';
import connectToDatabase from '@/lib/mongoose';

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { orderedFavoriteIds } = await request.json();

    if (!Array.isArray(orderedFavoriteIds) || orderedFavoriteIds.some((id) => typeof id !== 'string')) {
      return NextResponse.json(
        { error: 'Invalid input: orderedFavoriteIds must be an array of strings' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    for (let i = 0; i < orderedFavoriteIds.length; i++) {
      const favoriteId = orderedFavoriteIds[i];
      await UserFavoritesModel.findOneAndUpdate(
        { _id: favoriteId, user_id: user.id },
        { $set: { order: i } }
      );
    }

    return NextResponse.json({ message: 'Favorites reordered successfully' });
  } catch (err: any) {
    console.error('Error reordering favorites:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
