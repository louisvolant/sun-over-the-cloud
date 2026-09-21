import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Regression journey: an already logged-in user adds a favorite from the
// dedicated mobile /search page and expects to find it everywhere the
// favorites are listed (home carousel and account management list).
//
// Like the onboarding journey, this runs against an in-memory fake backend so
// it is deterministic and offline while still exercising the real frontend
// (routing, IndexedDB cache, optimistic auth and the favorites sync).
// ---------------------------------------------------------------------------

interface FakeFavorite {
  _id: string;
  user_id: string;
  location_name: string;
  latitude: number;
  longitude: number;
  country_code: string;
  order: number;
}

interface FakeLocation {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state: string;
  location_name: string;
}

// Mobile viewport: the home favorites view is the swipeable carousel below md.
test.use({ viewport: { width: 390, height: 844 } });

const USER_ID = 'user_1';

const PARIS: FakeFavorite = {
  _id: 'fav_paris',
  user_id: USER_ID,
  location_name: 'Paris',
  latitude: 48.8566,
  longitude: 2.3522,
  country_code: 'FR',
  order: 0,
};

const SEARCH_FIXTURES: Record<string, FakeLocation[]> = {
  paris: [
    {
      name: 'Paris',
      lat: 48.8566,
      lon: 2.3522,
      country: 'FR',
      state: 'Île-de-France',
      location_name: 'Paris, Île-de-France',
    },
  ],
  lyon: [
    {
      name: 'Lyon',
      lat: 45.764,
      lon: 4.8357,
      country: 'FR',
      state: 'Auvergne-Rhône-Alpes',
      location_name: 'Lyon, Auvergne-Rhône-Alpes',
    },
    {
      name: 'Villeurbanne',
      lat: 45.7719,
      lon: 4.8902,
      country: 'FR',
      state: 'Auvergne-Rhône-Alpes',
      location_name: 'Villeurbanne, Auvergne-Rhône-Alpes',
    },
  ],
};

function fakeSearch(city: string): FakeLocation[] {
  return SEARCH_FIXTURES[city.trim().toLowerCase()] ?? [];
}

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

function fakeForecast() {
  const now = Math.floor(Date.now() / 1000);
  const list = Array.from({ length: 8 }, (_, i) => ({
    dt: now + i * 3600,
    main: { temp: 20 + i * 0.5, temp_min: 18 + i * 0.5, temp_max: 22 + i * 0.5 },
    weather: [{ icon: '01d', description: 'clear sky' }],
  }));
  return { list, timezone: 'Europe/Paris' };
}

/**
 * Install the in-memory fake backend for the favorites journey.
 * `failAddFavorite` simulates the production issue where the database write
 * fails so the UI must not pretend the favorite was saved.
 */
async function installFakeBackend(page: Page, { failAddFavorite = false } = {}) {
  const favorites: FakeFavorite[] = [{ ...PARIS }];

  // Already logged in when the PWA opens (optimistic auth local flag).
  await page.addInitScript(() => window.localStorage.setItem('auth_token', '1'));

  // Keep the PWA service worker out of the way.
  await page.route('**/sw.js', (route) => route.abort());

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    const send = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathname === '/api/check-auth' && method === 'POST') {
      return send({ isAuthenticated: true });
    }
    if (pathname === '/api/favorites' && method === 'GET') {
      return send([...favorites].sort((a, b) => a.order - b.order));
    }
    if (pathname === '/api/add-favorite' && method === 'POST') {
      if (failAddFavorite) {
        return send({ error: 'Internal server error' }, 500);
      }
      const body = request.postDataJSON();
      const favorite: FakeFavorite = {
        _id: `fav_${favorites.length + 1}`,
        user_id: USER_ID,
        location_name: body.location_name,
        latitude: body.latitude,
        longitude: body.longitude,
        country_code: body.country_code,
        order: favorites.length,
      };
      favorites.push(favorite);
      return send(favorite, 201);
    }
    if (pathname === '/api/remove-favorite' && method === 'POST') {
      return send({ success: true });
    }
    if (pathname === '/api/search' && method === 'GET') {
      return send(fakeSearch(new URL(request.url()).searchParams.get('city') || ''));
    }
    if (pathname === '/api/cached-favorites' && method === 'GET') {
      return send([]);
    }
    if (pathname === '/api/onecall' && method === 'GET') {
      return send(fakeOneCall());
    }
    if (pathname === '/api/forecast' && method === 'GET') {
      return send(fakeForecast());
    }
    if (pathname === '/api/onecallmonthsummary' && method === 'GET') {
      return send([]);
    }
    return send({ error: `No fake handler for ${method} ${pathname}` }, 404);
  });

  return { favorites };
}

/** Open the /search page and add Lyon through its result row star. */
async function addLyonFromSearch(page: Page) {
  await page.getByRole('link', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/search$/);

  await page.locator('input[type="text"]').first().fill('Lyon');
  const lyonRow = page.locator('div.cursor-pointer', { hasText: 'Lyon, FR' }).first();
  await expect(lyonRow).toBeVisible({ timeout: 15000 });
  await lyonRow.getByRole('button', { name: 'Add to favorites' }).click();
  return lyonRow;
}

test.describe('Add favorite from the search page', () => {
  test('the new favorite appears on the home carousel and in the account list', async ({ page }) => {
    test.setTimeout(60_000);
    await installFakeBackend(page);

    // 1. The logged-in user lands on home: the existing favorite is displayed.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Paris', exact: true })).toBeVisible({ timeout: 15000 });

    // 2. The user searches a new location and adds it with the star action.
    const lyonRow = await addLyonFromSearch(page);
    await expect(lyonRow.getByRole('button', { name: 'In favorites' })).toBeVisible();

    // 3. Back on home, the freshly added favorite is part of the carousel.
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Lyon', exact: true })).toBeVisible({ timeout: 15000 });

    // 4. The account management list shows it as well.
    await page.getByRole('link', { name: 'My Account' }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.locator('li', { hasText: 'Lyon' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('li', { hasText: 'Paris' })).toBeVisible();
  });

  test('a failed add surfaces an error and does not fill the star', async ({ page }) => {
    test.setTimeout(60_000);
    await installFakeBackend(page, { failAddFavorite: true });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Paris', exact: true })).toBeVisible({ timeout: 15000 });

    const lyonRow = await addLyonFromSearch(page);

    // The star must stay actionable and the failure must be visible: a failed
    // write used to leave a filled star while the favorite was never saved.
    await expect(page.getByText(/Failed to add favorite/)).toBeVisible({ timeout: 15000 });
    await expect(lyonRow.getByRole('button', { name: 'Add to favorites' })).toBeVisible();
    await expect(lyonRow.getByRole('button', { name: 'In favorites' })).toHaveCount(0);

    // And it must not be listed on the account page.
    await page.getByRole('link', { name: 'My Account' }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.locator('li', { hasText: 'Lyon' })).toHaveCount(0);
  });
});
