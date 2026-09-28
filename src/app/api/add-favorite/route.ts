// src/app/api/add-favorite/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { findFavorite, findHighestOrderFavorite, insertFavorite } from '@/lib/data';

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

    const existingFavorite = await findFavorite({
      userId: user.id,
      locationName: location_name,
      latitude,
      longitude,
      countryCode: country_code,
    });

    if (existingFavorite) {
      return NextResponse.json(existingFavorite);
    }

    const highestOrderFavorite = await findHighestOrderFavorite(user.id);
    const newOrder = highestOrderFavorite ? highestOrderFavorite.order + 1 : 0;

    const newFavorite = await insertFavorite({
      userId: user.id,
      locationName: location_name,
      latitude,
      longitude,
      countryCode: country_code,
      order: newOrder,
    });

    return NextResponse.json(newFavorite, { status: 201 });
  } catch (err: any) {
    console.error('Error adding favorite:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
