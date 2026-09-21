// src/app/api/add-favorite/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { UserFavoritesModel } from '@/lib/models';
import connectToDatabase, { withDbRetry } from '@/lib/mongoose';
import { withDbTimeout } from '@/lib/timeout';

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { location_name, latitude, longitude, country_code } = body;

    if (!location_name || latitude == null || longitude == null || !country_code) {
      return NextResponse.json(
        { error: 'Missing required fields (location_name, latitude, longitude, country_code)' },
        { status: 400 }
      );
    }

    await withDbRetry(() => connectToDatabase());

    const existingFavorite = await withDbRetry(() =>
      UserFavoritesModel.findOne({
        user_id: user.id,
        location_name,
        latitude,
        longitude,
        country_code,
      }),
    );

    if (existingFavorite) {
      return NextResponse.json(existingFavorite);
    }

    const highestOrderFavorite = await withDbRetry(() =>
      UserFavoritesModel.findOne({ user_id: user.id })
        .sort({ order: -1 })
        .limit(1),
    );

    const newOrder = highestOrderFavorite ? highestOrderFavorite.order + 1 : 0;

    const newFavorite = new UserFavoritesModel({
      user_id: user.id,
      location_name,
      longitude,
      latitude,
      country_code,
      order: newOrder,
    });

    // Saves are not retried: replaying an insert whose response was lost could
    // create a duplicate favorite. Reads and the connection are safe to retry.
    await withDbTimeout(newFavorite.save());
    return NextResponse.json(newFavorite, { status: 201 });
  } catch (err: any) {
    console.error('Error adding favorite:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
