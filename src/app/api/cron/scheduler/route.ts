// src/app/api/cron/scheduler/route.ts
import { NextResponse } from 'next/server';
import { UserFavoritesModel } from '@/lib/models';
import { fetchAndSaveDaySummary } from '@/services/oneCallService';
import connectToDatabase from '@/lib/mongoose';

export async function GET() {
  console.log('Starting scheduled check...');

  try {
    await connectToDatabase();
    const allFavorites = await UserFavoritesModel.find({});
    if (!allFavorites || allFavorites.length === 0) {
      return NextResponse.json({ message: 'No favorite locations to process' });
    }

    const uniqueFavorites = Array.from(
      new Map(
        allFavorites.map((fav) => [
          `${fav.latitude},${fav.longitude}`,
          { latitude: fav.latitude, longitude: fav.longitude, location_name: fav.location_name },
        ])
      ).values()
    );

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const formattedDate = yesterday.toISOString().split('T')[0];

    const results = await Promise.all(
      uniqueFavorites.map(async (fav) => {
        try {
          const result = await fetchAndSaveDaySummary(fav.latitude, fav.longitude, formattedDate);
          if (result.success) {
            return { location: fav.location_name, status: 'success', data: result.data };
          } else {
            return { location: fav.location_name, status: 'error', error: result.error };
          }
        } catch (error: any) {
          return { location: fav.location_name, status: 'error', error: error.message };
        }
      })
    );

    const successCount = results.filter((r) => r.status === 'success').length;
    const errorCount = results.length - successCount;

    return NextResponse.json({
      message: 'Scheduled check completed',
      summary: {
        total: results.length,
        successes: successCount,
        errors: errorCount,
        details: results,
      },
    });
  } catch (err: any) {
    console.error('Critical error in cron job:', err);
    return NextResponse.json({ error: 'Internal server error during scheduled check' }, { status: 500 });
  }
}
