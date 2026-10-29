import { test, expect, Page } from '@playwright/test';

const FAVORITES = [
  {
    _id: 'fav-1',
    user_id: 'u1',
    location_name: 'Paris',
    latitude: 48.8566,
    longitude: 2.3522,
    country_code: 'FR',
    order: 0,
  },
  {
    _id: 'fav-2',
    user_id: 'u1',
    location_name: 'Lyon',
    latitude: 45.764,
    longitude: 4.8357,
    country_code: 'FR',
    order: 1,
  },
  {
    _id: 'fav-3',
    user_id: 'u1',
    location_name: 'Marseille',
    latitude: 43.2965,
    longitude: 5.3698,
    country_code: 'FR',
    order: 2,
  },
  {
    _id: 'fav-4',
    user_id: 'u1',
    location_name: 'Bordeaux',
    latitude: 44.8378,
    longitude: -0.5792,
    country_code: 'FR',
    order: 3,
  },
];

async function installFakeBackend(
  page: Page,
  options: { gateFirstOneCall?: boolean } = {}
) {
  const now = Math.floor(Date.now() / 1000);
  const quarterStart = Math.floor(now / 900) * 900;
  let oneCallCount = 0;
  let releaseFirstOneCall: () => void = () => {};
  const firstOneCallGate = new Promise<void>((resolve) => {
    releaseFirstOneCall = resolve;
  });

  await page.addInitScript(() => window.localStorage.setItem('auth_token', '1'));
  await page.route('**/sw.js', (route) => route.abort());
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const send = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathname === '/api/check-auth') {
      return send({ isAuthenticated: true, user: { id: 'u1', username: 'testuser' } });
    }
    if (pathname === '/api/favorites') return send(FAVORITES);
    if (pathname === '/api/cached-favorites') return send([]);
    if (pathname === '/api/onecall') {
      oneCallCount += 1;
      if (options.gateFirstOneCall && oneCallCount === 1) {
        await firstOneCallGate;
      }
      return send({
        current: {
          temp: 14.5,
          feels_like: 13,
          humidity: 82,
          pressure: 1012,
          weather: [{ description: 'light rain', icon: '10d' }],
          wind_speed: 4.2,
          wind_deg: 240,
          clouds: 75,
          visibility: 9000,
          sunrise: now - 3600,
          sunset: now + 3600,
        },
        daily: [{ rain: 2.3, snow: 0 }],
        minutely_15: [
          { dt: quarterStart, precipitation: 0.2, rain: 0.2, snowfall: 0 },
          { dt: quarterStart + 900, precipitation: 0.8, rain: 0.8, snowfall: 0 },
          { dt: quarterStart + 1800, precipitation: 0.4, rain: 0.4, snowfall: 0 },
          { dt: quarterStart + 2700, precipitation: 0.1, rain: 0.1, snowfall: 0 },
        ],
        timezone: 'Europe/Paris',
        timezone_offset: 3600,
      });
    }
    if (pathname === '/api/forecast') {
      const list = Array.from({ length: 24 }, (_, i) => ({
        dt: now + i * 3600,
        main: { temp: 14, temp_min: 12, temp_max: 16 },
        weather: [{ icon: '10d', description: 'light rain' }],
      }));
      return send({ list, timezone: 'Europe/Paris' });
    }
    if (pathname === '/api/onecallmonthsummary') return send([]);
    return send({});
  });

  return { releaseFirstOneCall };
}

function trackOneCallRequests(page: Page) {
  const requests: { lat: number; at: number }[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/onecall') {
      requests.push({ lat: Number(url.searchParams.get('lat')), at: Date.now() });
    }
  });
  return requests;
}

test.describe('Carousel weather request scheduling', () => {
  test('deduplicates the hidden desktop/mobile trees and refreshes favorites in order', async ({
    page,
  }) => {
    await installFakeBackend(page);
    const oneCallRequests = trackOneCallRequests(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect
      .poll(() => oneCallRequests.length, { timeout: 15000 })
      .toBe(FAVORITES.length);

    // The same locations are mounted twice (mobile carousel + hidden desktop
    // favorite cards); deduplication must still produce exactly one request per
    // location instead of the previous ~2x burst.
    expect(oneCallRequests.map((request) => request.lat)).toEqual(
      FAVORITES.map((favorite) => favorite.latitude)
    );

    // Requests are serialized with a small gap instead of being sent as a burst.
    for (let i = 1; i < oneCallRequests.length; i += 1) {
      expect(oneCallRequests[i].at - oneCallRequests[i - 1].at).toBeGreaterThanOrEqual(90);
    }
  });

  test('promotes the slide the user swipes to ahead of pending refreshes', async ({ page }) => {
    // Hold the first request until the user has swiped to the last slide, so
    // the remaining favorites are still queued when the priority changes.
    const backend = await installFakeBackend(page, { gateFirstOneCall: true });
    const oneCallRequests = trackOneCallRequests(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const bordeauxDot = page.locator('button[aria-label="Bordeaux"]');
    await expect(bordeauxDot).toBeVisible({ timeout: 15000 });
    await expect.poll(() => oneCallRequests.length, { timeout: 15000 }).toBe(1);
    await bordeauxDot.click();

    await expect(page.locator('button[aria-current="true"]')).toHaveAttribute(
      'aria-label',
      'Bordeaux'
    );

    // Let React flush the priority update while the first request is gated.
    await page.waitForTimeout(300);
    backend.releaseFirstOneCall();

    await expect
      .poll(() => oneCallRequests.length, { timeout: 15000 })
      .toBeGreaterThanOrEqual(2);

    // Paris started immediately; after the user jumped to Bordeaux, Bordeaux
    // must be the next location refreshed rather than the intermediate ones.
    expect(oneCallRequests[0].lat).toBe(FAVORITES[0].latitude);
    expect(oneCallRequests[1].lat).toBe(FAVORITES[3].latitude);
  });
});
