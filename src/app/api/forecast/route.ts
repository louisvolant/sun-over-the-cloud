// src/app/api/forecast/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getForecast } from '@/services/metNorwayService';
import { FORECAST_CACHE_CONTROL } from '@/lib/constants';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Latitude and Longitude parameters are required' }, { status: 400 });
  }

  try {
    const data = await getForecast(parseFloat(lat), parseFloat(lon));
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': FORECAST_CACHE_CONTROL,
      },
    });
  } catch (error: unknown) {
    console.error(
      'API Error /api/forecast:',
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json({ error: 'Failed to fetch forecast data' }, { status: 500 });
  }
}
