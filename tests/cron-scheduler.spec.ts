import { test, expect } from '@playwright/test';
import { GET as cronRoute } from '@/app/api/cron/scheduler/route';
import { setTestEnv, AppEnv, D1Database, D1PreparedStatement, D1Result, KVNamespace } from '@/lib/cloudflare';
import { NextRequest } from 'next/server';

function createMockCronEnv(favorites: Array<{ location_name: string; latitude: number; longitude: number }>) {
  const db: D1Database = {
    prepare(query: string): D1PreparedStatement {
      const stmt: D1PreparedStatement = {
        bind() {
          return stmt;
        },
        async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
          return { success: true };
        },
        async first<T = Record<string, unknown>>(): Promise<T | null> {
          return null;
        },
        async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
          if (query.includes('FROM user_favorites')) {
            return { success: true, results: favorites as unknown as T[] };
          }
          return { success: true, results: [] };
        },
      };
      return stmt;
    },
    async batch() {
      return [];
    },
    async exec() {
      return { success: true };
    },
  };

  const kvStore = new Map<string, string>();
  const dummyKV: KVNamespace = {
    async get(key: string) {
      return kvStore.get(key) || null;
    },
    async put(key: string, value: string) {
      kvStore.set(key, value);
    },
    async delete(key: string) {
      kvStore.delete(key);
    },
  };

  const env: AppEnv = {
    DB: db,
    CACHE: dummyKV,
  };

  return { env, kvStore };
}

test.describe('Cron Scheduler Chunking and Batching', () => {
  test.afterEach(() => {
    setTestEnv(null);
  });

  test('returns early with message when no favorites exist', async () => {
    const { env } = createMockCronEnv([]);
    setTestEnv(env);

    const req = new NextRequest('http://localhost:3000/api/cron/scheduler', {
      headers: { Origin: 'http://localhost:3000' },
    });

    const res = await cronRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('No favorite locations to process');
    expect(body.totalUniqueLocations).toBe(0);
  });

  test('processes locations in batches with pagination metadata to prevent CPU spikes', async () => {
    // 6 unique locations
    const mockFavs = [
      { location_name: 'Paris', latitude: 48.85, longitude: 2.35 },
      { location_name: 'Lyon', latitude: 45.76, longitude: 4.83 },
      { location_name: 'Marseille', latitude: 43.29, longitude: 5.37 },
      { location_name: 'Bordeaux', latitude: 44.83, longitude: -0.57 },
      { location_name: 'Lille', latitude: 50.62, longitude: 3.05 },
      { location_name: 'Nantes', latitude: 47.21, longitude: -1.55 },
    ];

    const { env, kvStore } = createMockCronEnv(mockFavs);
    // Pre-populate KV for all so fetchAndSaveDaySummary does not trigger upstream HTTP calls
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    for (const f of mockFavs) {
      kvStore.set(
        `daysummary:${f.latitude}:${f.longitude}:${dateStr}`,
        JSON.stringify({ date: dateStr, precipitation: { total: 0 }, humidity: { afternoon: 50 }, cloud_cover: { afternoon: 20 } })
      );
    }

    setTestEnv(env);

    // Request with limit=2, offset=0
    const req1 = new NextRequest('http://localhost:3000/api/cron/scheduler?limit=2&offset=0', {
      headers: { Origin: 'http://localhost:3000' },
    });

    const res1 = await cronRoute(req1);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();

    expect(body1.pagination.totalUniqueLocations).toBe(6);
    expect(body1.pagination.processedCount).toBe(2);
    expect(body1.pagination.hasMore).toBe(true);
    expect(body1.pagination.nextOffset).toBe(2);
    expect(body1.summary.successes).toBe(2);

    // Second batch with limit=2, offset=2
    const req2 = new NextRequest('http://localhost:3000/api/cron/scheduler?limit=2&offset=2', {
      headers: { Origin: 'http://localhost:3000' },
    });

    const res2 = await cronRoute(req2);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();

    expect(body2.pagination.processedCount).toBe(2);
    expect(body2.pagination.offset).toBe(2);
    expect(body2.pagination.nextOffset).toBe(4);
    expect(body2.pagination.hasMore).toBe(true);

    // Beyond range: offset=6
    const req3 = new NextRequest('http://localhost:3000/api/cron/scheduler?limit=2&offset=6', {
      headers: { Origin: 'http://localhost:3000' },
    });

    const res3 = await cronRoute(req3);
    expect(res3.status).toBe(200);
    const body3 = await res3.json();
    expect(body3.hasMore).toBe(false);
    expect(body3.processedCount).toBe(0);
  });
});
