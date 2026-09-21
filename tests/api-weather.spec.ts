import { test, expect } from '@playwright/test';

test.describe('Weather and Geocoding APIs', () => {
  test('GET /api/search - returns 400 if city is missing', async ({ request }) => {
    const response = await request.get('/api/search');
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('City parameter is required');
  });

  test('GET /api/search - returns search results for a valid city', async ({ request }) => {
    const response = await request.get('/api/search?city=Paris&lang=fr');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    const first = body[0];
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('lat');
    expect(first).toHaveProperty('lon');
    expect(first).toHaveProperty('country');
  });

  test('GET /api/search - ranks major cities first for prefix queries', async ({ request }) => {
    // The upstream geocoder lists tiny same-prefix villages before
    // Boulogne-Billancourt; the route must re-rank by population.
    const response = await request.get('/api/search?city=Boulogne&lang=fr');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);

    const names = body.map((item: { name: string }) => item.name);
    expect(names).toContain('Boulogne-Billancourt');
    expect(names).toContain('Boulogne-sur-Mer');
    expect(names.indexOf('Boulogne-Billancourt')).toBeLessThan(
      names.indexOf('Boulogne-sur-Mer'),
    );
  });

  test('GET /api/onecall - returns 400 if coordinates are missing', async ({ request }) => {
    const response = await request.get('/api/onecall');
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Latitude and Longitude');
  });

  test('GET /api/onecall - returns current weather from MET Norway', async ({ request }) => {
    const response = await request.get('/api/onecall?lat=48.8534&lon=2.3488');
    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body).toHaveProperty('current');
    expect(body.current).toHaveProperty('temp');
    expect(typeof body.current.temp).toBe('number');
    expect(body.current).toHaveProperty('humidity');
    expect(body.current).toHaveProperty('feels_like');
    expect(body.current).toHaveProperty('weather');
    expect(Array.isArray(body.current.weather)).toBe(true);
    expect(body.current.weather[0]).toHaveProperty('description');
    expect(body.current.weather[0]).toHaveProperty('icon');

    expect(body).toHaveProperty('daily');
    expect(Array.isArray(body.daily)).toBe(true);

    expect(body).toHaveProperty('timezone');
    expect(body.timezone).toBe('Europe/Paris');
  });

  test('GET /api/forecast - returns 400 if coordinates are missing', async ({ request }) => {
    const response = await request.get('/api/forecast');
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Latitude and Longitude');
  });

  test('GET /api/forecast - returns multi-day forecast list from MET Norway', async ({ request }) => {
    const response = await request.get('/api/forecast?lat=48.8534&lon=2.3488');
    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body).toHaveProperty('list');
    expect(Array.isArray(body.list)).toBe(true);
    expect(body.list.length).toBeGreaterThan(0);

    const item = body.list[0];
    expect(item).toHaveProperty('dt');
    expect(item).toHaveProperty('main');
    expect(item.main).toHaveProperty('temp');
    expect(item).toHaveProperty('weather');
    expect(item.weather[0]).toHaveProperty('icon');
  });

  test('GET /api/onecallmonthsummary - returns 400 if parameters are missing', async ({ request }) => {
    const response = await request.get('/api/onecallmonthsummary?lat=48.85&lon=2.35');
    expect(response.status()).toBe(400);
  });

  test('GET /api/onecallmonthsummary - returns monthly precipitation history from Open-Meteo', async ({ request }) => {
    const response = await request.get('/api/onecallmonthsummary?lat=48.85&lon=2.35&year=2024&month=5');
    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(31); // May has 31 days

    const day1 = body[0];
    expect(day1).toHaveProperty('date', '2024-05-01');
    expect(day1).toHaveProperty('precipitation');
    expect(typeof day1.precipitation.total).toBe('number');
    expect(day1).toHaveProperty('humidity');
    expect(day1).toHaveProperty('cloud_cover');
  });
});
