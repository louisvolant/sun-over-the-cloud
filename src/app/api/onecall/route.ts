// src/app/api/onecall/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWeather } from '@/services/metNorwayService';
import { ONECALL_CACHE_CONTROL } from '@/lib/constants';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Latitude and Longitude parameters are required' }, { status: 400 });
  }

  try {
    const data = await getCurrentWeather(parseFloat(lat), parseFloat(lon));
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': ONECALL_CACHE_CONTROL,
      },
    });
  } catch (error: unknown) {
    console.error(
      'API Error /api/onecall:',
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json({ error: 'Failed to fetch weather data from MET Norway' }, { status: 500 });
  }
}
