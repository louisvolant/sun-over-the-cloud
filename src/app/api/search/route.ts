// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { LocationSearchModel } from '@/lib/models';
import connectToDatabase from '@/lib/mongoose';

const OPEN_METEO_GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city');
  const lang = searchParams.get('lang') || 'en';

  if (!city) {
    return NextResponse.json({ error: 'City parameter is required' }, { status: 400 });
  }

  // Try checking cache if MongoDB is available
  try {
    await connectToDatabase();
    const existingData = await LocationSearchModel.findOne({ city, lang });
    if (existingData) {
      return NextResponse.json(existingData.data);
    }
  } catch (dbErr: any) {
    // If DB is unreachable or not configured, proceed directly to live API fetch
    console.warn('MongoDB cache lookup skipped or failed in /api/search:', dbErr.message);
  }

  try {
    const response = await axios.get(OPEN_METEO_GEOCODING_API, {
      params: {
        name: city,
        count: 5,
        language: lang,
        format: 'json',
      },
    });

    const rawResults = response.data?.results || [];
    const formattedLocations = rawResults.map((item: any) => ({
      name: item.name,
      lat: item.latitude,
      lon: item.longitude,
      country: item.country_code,
      state: item.admin1,
      location_name: item.admin1 ? `${item.name}, ${item.admin1}` : item.name,
    }));

    // Best-effort cache save
    try {
      const newDoc = new LocationSearchModel({
        city,
        lang,
        data: formattedLocations,
      });
      await newDoc.save();
    } catch {
      // Ignore DB save errors when database is unavailable
    }

    return NextResponse.json(formattedLocations);
  } catch (error: any) {
    console.error('Error in /api/search:', error.message);
    return NextResponse.json({ error: 'Failed to fetch location data' }, { status: 500 });
  }
}
