import { test, expect } from '@playwright/test';
import { GET as onecallRoute } from '@/app/api/onecall/route';
import { GET as forecastRoute } from '@/app/api/forecast/route';
import { GET as searchRoute } from '@/app/api/search/route';
import { GET as monthSummaryRoute } from '@/app/api/onecallmonthsummary/route';
import {
  ONECALL_CACHE_CONTROL,
  FORECAST_CACHE_CONTROL,
  SEARCH_CACHE_CONTROL,
  MONTH_SUMMARY_CACHE_CONTROL,
} from '@/lib/constants';
import { NextRequest } from 'next/server';

test.describe('Edge Cache-Control Headers on Weather and Search APIs', () => {
  test('constants have valid public and s-maxage directives', () => {
    expect(ONECALL_CACHE_CONTROL).toContain('public');
    expect(ONECALL_CACHE_CONTROL).toContain('s-maxage=');
    expect(ONECALL_CACHE_CONTROL).toContain('stale-while-revalidate=');

    expect(FORECAST_CACHE_CONTROL).toContain('public');
    expect(FORECAST_CACHE_CONTROL).toContain('s-maxage=');

    expect(SEARCH_CACHE_CONTROL).toContain('public');
    expect(SEARCH_CACHE_CONTROL).toContain('s-maxage=');

    expect(MONTH_SUMMARY_CACHE_CONTROL).toContain('public');
    expect(MONTH_SUMMARY_CACHE_CONTROL).toContain('s-maxage=');
  });

  test('GET /api/onecall response sets CDN Cache-Control header', async () => {
    const req = new NextRequest('http://localhost:3000/api/onecall?lat=48.8534&lon=2.3488');
    const res = await onecallRoute(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(ONECALL_CACHE_CONTROL);
  });

  test('GET /api/forecast response sets CDN Cache-Control header', async () => {
    const req = new NextRequest('http://localhost:3000/api/forecast?lat=48.8534&lon=2.3488');
    const res = await forecastRoute(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(FORECAST_CACHE_CONTROL);
  });

  test('GET /api/search response sets CDN Cache-Control header', async () => {
    const req = new NextRequest('http://localhost:3000/api/search?city=Paris', {
      headers: { Origin: 'http://localhost:3000' },
    });
    const res = await searchRoute(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(SEARCH_CACHE_CONTROL);
  });

  test('GET /api/onecallmonthsummary response sets CDN Cache-Control header', async () => {
    const req = new NextRequest('http://localhost:3000/api/onecallmonthsummary?lat=48.85&lon=2.35&year=2024&month=5');
    const res = await monthSummaryRoute(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(MONTH_SUMMARY_CACHE_CONTROL);
  });
});
