// src/app/api/remove-favorite/route.ts
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
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing favorite ID' }, { status: 400 });
    }

    await connectToDatabase();

    const result = await UserFavoritesModel.findOneAndDelete({
      _id: id,
      user_id: user.id,
    });

    if (!result) {
      return NextResponse.json({ error: 'Favorite not found' }, { status: 404 });
    }

    const remainingFavorites = await UserFavoritesModel.find({ user_id: user.id }).sort({ order: 1 });
    for (let i = 0; i < remainingFavorites.length; i++) {
      if (remainingFavorites[i].order !== i) {
        remainingFavorites[i].order = i;
        await remainingFavorites[i].save();
      }
    }

    return NextResponse.json({ message: 'Favorite removed successfully' });
  } catch (err: any) {
    console.error('Error removing favorite:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
