// src/app/api/onecall/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWeather } from '@/services/metNorwayService';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Latitude and Longitude parameters are required' }, { status: 400 });
  }

  try {
    const data = await getCurrentWeather(parseFloat(lat), parseFloat(lon));
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('API Error /api/onecall:', error.message);
    return NextResponse.json({ error: 'Failed to fetch weather data from MET Norway' }, { status: 500 });
  }
}
