// src/app/api/cron/scheduler/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { listDistinctFavoriteLocations } from '@/lib/data';
import { fetchAndSaveDaySummary } from '@/services/oneCallService';
import { assertSameOrigin } from '@/lib/origin';

// Bounded concurrency and batch sizes to prevent Worker CPU spikes (p99 latency)
// when processing multiple distinct favorite locations.
const DEFAULT_BATCH_LIMIT = 10;
const MAX_BATCH_LIMIT = 25;
const CHUNK_CONCURRENCY = 3;

export async function GET(request: NextRequest) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const { searchParams } = new URL(request.url);
  const rawLimit = searchParams.get('limit');
  const rawOffset = searchParams.get('offset');

  const limit = Math.min(
    rawLimit ? Math.max(Number(rawLimit) || 1, 1) : DEFAULT_BATCH_LIMIT,
    MAX_BATCH_LIMIT
  );
  const offset = Math.max(Number(rawOffset) || 0, 0);

  console.log(`Starting scheduled check (offset=${offset}, limit=${limit})...`);

  try {
    const allFavorites = await listDistinctFavoriteLocations();
    if (!allFavorites || allFavorites.length === 0) {
      return NextResponse.json({
        message: 'No favorite locations to process',
        totalUniqueLocations: 0,
        processedCount: 0,
      });
    }

    const uniqueFavorites = Array.from(
      new Map(
        allFavorites.map((fav) => [
          `${fav.latitude},${fav.longitude}`,
          { latitude: fav.latitude, longitude: fav.longitude, location_name: fav.location_name },
        ])
      ).values()
    );

    const totalUniqueLocations = uniqueFavorites.length;
    const batchTargets = uniqueFavorites.slice(offset, offset + limit);

    if (batchTargets.length === 0) {
      return NextResponse.json({
        message: 'All locations already processed for this offset',
        totalUniqueLocations,
        processedCount: 0,
        hasMore: false,
      });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const formattedDate = yesterday.toISOString().split('T')[0];

    // Process in bounded chunks of CHUNK_CONCURRENCY to smooth CPU consumption
    const results: Array<{
      location: string;
      status: 'success' | 'error';
      data?: unknown;
      error?: string;
    }> = [];

    for (let i = 0; i < batchTargets.length; i += CHUNK_CONCURRENCY) {
      const chunk = batchTargets.slice(i, i + CHUNK_CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async (fav) => {
          try {
            const result = await fetchAndSaveDaySummary(fav.latitude, fav.longitude, formattedDate);
            if (result.success) {
              return { location: fav.location_name, status: 'success' as const, data: result.data };
            } else {
              return { location: fav.location_name, status: 'error' as const, error: result.error };
            }
          } catch (error: unknown) {
            return {
              location: fav.location_name,
              status: 'error' as const,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );
      results.push(...chunkResults);
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    const errorCount = results.length - successCount;
    const nextOffset = offset + batchTargets.length;
    const hasMore = nextOffset < totalUniqueLocations;

    return NextResponse.json({
      message: 'Scheduled check completed',
      pagination: {
        totalUniqueLocations,
        offset,
        limit,
        processedCount: results.length,
        nextOffset: hasMore ? nextOffset : null,
        hasMore,
      },
      summary: {
        successes: successCount,
        errors: errorCount,
        details: results,
      },
    });
  } catch (err: unknown) {
    console.error('Critical error in cron job:', err);
    return NextResponse.json({ error: 'Internal server error during scheduled check' }, { status: 500 });
  }
}
