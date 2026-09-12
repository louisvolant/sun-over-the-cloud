// src/app/api/onecallmonthsummary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchMonthSummary } from '@/services/oneCallService';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const year = searchParams.get('year');
  const month = searchParams.get('month');

  if (!lat || !lon || !year || !month) {
    return NextResponse.json({ error: 'Latitude, Longitude, Year, and Month parameters are required' }, { status: 400 });
  }

  const result = await fetchMonthSummary(parseFloat(lat), parseFloat(lon), parseInt(year), parseInt(month));
  if (result.success) {
    return NextResponse.json(result.data);
  } else {
    console.error('API Error /api/onecallmonthsummary:', result.error);
    return NextResponse.json({ error: 'Failed to fetch monthly weather data' }, { status: 500 });
  }
}
