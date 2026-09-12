// src/app/api/favorites/route.ts
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { UserFavoritesModel } from '@/lib/models';
import connectToDatabase from '@/lib/mongoose';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const favorites = await UserFavoritesModel.find({ user_id: user.id }).sort({ order: 1 });
    return NextResponse.json(favorites);
  } catch (err: any) {
    console.error('Error fetching favorites:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
