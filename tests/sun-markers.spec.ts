import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Sunrise/sunset markers in the hourly forecast frieze.
//
// Runs against an in-memory fake backend so it is deterministic and offline:
// searching a location renders the forecast, whose first "Next hours" day is
// expanded by default and must interleave a sunrise and a sunset marker among
// the hourly slots, labelled in the selected language.
// ---------------------------------------------------------------------------

const PARIS = {
  name: 'Paris',
  lat: 48.8566,
  lon: 2.3522,
  country: 'FR',
  state: 'Île-de-France',
  location_name: 'Paris, Île-de-France',
};

function fakeOneCall() {
  const now = Math.floor(Date.now() / 1000);
  return {
    current: {
      temp: 20,
      feels_like: 19,
      humidity: 55,
      pressure: 1013,
      weather: [{ description: 'clear sky', icon: '01d' }],
      wind_speed: 3,
      wind_deg: 180,
      clouds: 5,
      visibility: 10000,
      sunrise: now - 3600,
      sunset: now + 3600,
    },
    daily: [{ rain: 0, snow: 0 }],
    timezone: 'Europe/Paris',
    timezone_offset: 3600,
  };
}

/**
 * 48 hourly slots starting at the next hour, so the rolling 24-hour window
 * always contains at least one sunrise and one sunset for Paris.
 */
function fakeForecast() {
  const now = Math.floor(Date.now() / 1000);
  const firstHour = Math.floor(now / 3600) * 3600 + 3600;
  const list = Array.from({ length: 48 }, (_, i) => ({
    dt: firstHour + i * 3600,
    main: { temp: 20 + i * 0.1, temp_min: 18, temp_max: 22 },
    weather: [{ icon: '01d', description: 'clear sky' }],
  }));
  return { list, timezone: 'Europe/Paris' };
}

async function installFakeBackend(page: Page, { language = 'en' } = {}) {
  await page.addInitScript((lang) => window.localStorage.setItem('language', lang), language);
  await page.route('**/sw.js', (route) => route.abort());

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    const send = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathname === '/api/check-auth') return send({ isAuthenticated: false });
    if (pathname === '/api/cached-favorites' || pathname === '/api/favorites') return send([]);
    if (pathname === '/api/search' && method === 'GET') return send([PARIS]);
    if (pathname === '/api/onecall' && method === 'GET') return send(fakeOneCall());
    if (pathname === '/api/forecast' && method === 'GET') return send(fakeForecast());
    return send({ error: `No fake handler for ${method} ${pathname}` }, 404);
  });
}

/**
 * Types a single-result search, which the app auto-selects after its debounce,
 * then waits for the forecast strip to render. Returns once the forecast card
 * (whose first "Next hours" day is expanded by default) is visible.
 */
async function searchParisAndOpenForecast(page: Page, forecastHeading: RegExp) {
  await page.goto('/');
  await page.locator('input[type="text"]').fill('Paris');
  await expect(page.getByRole('heading', { name: forecastHeading })).toBeVisible({ timeout: 15000 });
}

test.describe('Sunrise and sunset markers in the hourly frieze', () => {
  test('the expanded hourly strip shows sunrise and sunset markers', async ({ page }) => {
    test.setTimeout(60_000);
    await installFakeBackend(page, { language: 'en' });
    await searchParisAndOpenForecast(page, /weather forecast/i);

    const sunriseMarkers = page.getByRole('img', { name: /^Sunrise \d/ });
    const sunsetMarkers = page.getByRole('img', { name: /^Sunset \d/ });

    expect(await sunriseMarkers.count()).toBeGreaterThan(0);
    expect(await sunsetMarkers.count()).toBeGreaterThan(0);
  });

  test('markers are labelled in the selected language', async ({ page }) => {
    test.setTimeout(60_000);
    await installFakeBackend(page, { language: 'fr' });
    await searchParisAndOpenForecast(page, /prévisions météo/i);

    const sunriseMarkers = page.getByRole('img', { name: /^Lever du soleil \d/ });
    const sunsetMarkers = page.getByRole('img', { name: /^Coucher du soleil \d/ });

    expect(await sunriseMarkers.count()).toBeGreaterThan(0);
    expect(await sunsetMarkers.count()).toBeGreaterThan(0);
  });
});
