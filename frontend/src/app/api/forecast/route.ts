// src/app/api/forecast/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getForecast } from '@/services/metNorwayService';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Latitude and Longitude parameters are required' }, { status: 400 });
  }

  try {
    const data = await getForecast(parseFloat(lat), parseFloat(lon));
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('API Error /api/forecast:', error.message);
    return NextResponse.json({ error: 'Failed to fetch forecast data' }, { status: 500 });
  }
}
