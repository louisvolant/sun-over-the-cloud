import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// End-to-end onboarding journey, exercised against an in-memory fake backend.
//
// The app normally talks to MongoDB Atlas through /api/*, which is not
// configured in the Playwright environment. Instead of skipping the journey,
// every API call is intercepted and served by a tiny stateful fake (users,
// session, favorites). The test therefore runs deterministically and offline
// while still exercising the real frontend: routing, forms and validation,
// optimistic auth, IndexedDB restore and the session hand-off.
// ---------------------------------------------------------------------------

interface FakeUser {
  id: string;
  username: string;
  email: string;
  password: string;
}

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

const USERNAME = 'onboarding_user';
const EMAIL = 'onboarding_user@example.com';
// Registration requires at least 15 characters.
const INITIAL_PASSWORD = 'InitialPassword12345';
const UPDATED_PASSWORD = 'UpdatedPassword12345';

// Deterministic geocoding fixtures (the real /api/search is mocked).
const SEARCH_FIXTURES: Record<string, FakeLocation[]> = {
  boulogne: [
    {
      name: 'Boulogne-Billancourt',
      lat: 48.8352,
      lon: 2.2409,
      country: 'FR',
      state: 'Île-de-France',
      location_name: 'Boulogne-Billancourt, Île-de-France',
    },
    {
      name: 'Boulogne-sur-Mer',
      lat: 50.7264,
      lon: 1.6147,
      country: 'FR',
      state: 'Hauts-de-France',
      location_name: 'Boulogne-sur-Mer, Hauts-de-France',
    },
  ],
  paris: [
    {
      name: 'Paris',
      lat: 48.8566,
      lon: 2.3522,
      country: 'FR',
      state: 'Île-de-France',
      location_name: 'Paris, Île-de-France',
    },
    {
      name: 'Versailles',
      lat: 48.8014,
      lon: 2.1301,
      country: 'FR',
      state: 'Île-de-France',
      location_name: 'Versailles, Île-de-France',
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
  const key = city.trim().toLowerCase();
  return (
    SEARCH_FIXTURES[key] ?? [
      { name: city, lat: 0, lon: 0, country: 'FR', state: '', location_name: city },
    ]
  );
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

test.describe('Onboarding journey (mocked backend)', () => {
  test('visitor searches, registers, adds favorites, changes password, removes one, logs out and logs back in', async ({
    page,
  }) => {
    test.setTimeout(90_000);

    // --- In-memory fake backend state --------------------------------------
    const users: FakeUser[] = [];
    const favorites: FakeFavorite[] = [];
    let loggedInUserId: string | null = null;
    const currentUser = () => users.find((u) => u.id === loggedInUserId) || null;
    const newId = () => `id_${Math.random().toString(36).slice(2, 10)}`;

    // Auto-accept the window.confirm() used before removing a favorite.
    page.on('dialog', (dialog) => dialog.accept());

    // Keep the PWA service worker out of the way: it can reload the page when
    // it takes control, which would interrupt the long chained journey.
    await page.route('**/sw.js', (route) => route.abort());

    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const { pathname } = new URL(request.url());
      const method = request.method();
      const send = (body: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(body),
        });

      // --- Authentication --------------------------------------------------
      if (pathname === '/api/check-auth' && method === 'POST') {
        return send({ isAuthenticated: !!currentUser() });
      }
      if (pathname === '/api/register' && method === 'POST') {
        const { username, email, password } = request.postDataJSON();
        const exists = users.some(
          (u) =>
            u.username.toLowerCase() === String(username).toLowerCase() ||
            u.email.toLowerCase() === String(email).toLowerCase(),
        );
        if (exists) return send({ error: 'User already exists' }, 409);
        const user: FakeUser = { id: newId(), username, email, password };
        users.push(user);
        loggedInUserId = user.id;
        return send({ success: true });
      }
      if (pathname === '/api/login' && method === 'POST') {
        const { username, password } = request.postDataJSON();
        const user = users.find(
          (u) =>
            u.username.toLowerCase() === String(username).toLowerCase() ||
            u.email.toLowerCase() === String(username).toLowerCase(),
        );
        if (!user || user.password !== password) {
          return send({ success: false, error: 'Invalid credentials' }, 401);
        }
        loggedInUserId = user.id;
        return send({ success: true });
      }
      if (pathname === '/api/logout' && method === 'POST') {
        loggedInUserId = null;
        return send({ success: true });
      }
      if (pathname === '/api/changepassword' && method === 'POST') {
        const user = currentUser();
        if (!user) return send({ success: false, error: 'Unauthorized' }, 401);
        user.password = request.postDataJSON().newpassword;
        return send({ success: true });
      }

      // --- Favorites -------------------------------------------------------
      if (pathname === '/api/favorites' && method === 'GET') {
        const user = currentUser();
        if (!user) return send({ error: 'Unauthorized' }, 401);
        return send(
          favorites
            .filter((f) => f.user_id === user.id)
            .sort((a, b) => a.order - b.order),
        );
      }
      if (pathname === '/api/add-favorite' && method === 'POST') {
        const user = currentUser();
        if (!user) return send({ error: 'Unauthorized' }, 401);
        const body = request.postDataJSON();
        const owned = favorites.filter((f) => f.user_id === user.id);
        const favorite: FakeFavorite = {
          _id: newId(),
          user_id: user.id,
          location_name: body.location_name,
          latitude: body.latitude,
          longitude: body.longitude,
          country_code: body.country_code,
          order: owned.length,
        };
        favorites.push(favorite);
        return send(favorite);
      }
      if (pathname === '/api/remove-favorite' && method === 'POST') {
        const user = currentUser();
        if (!user) return send({ error: 'Unauthorized' }, 401);
        const { id } = request.postDataJSON();
        const index = favorites.findIndex((f) => f._id === id && f.user_id === user.id);
        if (index !== -1) favorites.splice(index, 1);
        return send({ success: true });
      }
      if (pathname === '/api/reorder-favorites' && method === 'POST') {
        return send({ success: true });
      }

      // --- Geocoding and weather ------------------------------------------
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

    // 1. A visitor lands on the site and runs a first search.
    await test.step('Visitor lands and runs a first search', async () => {
      await page.goto('/');
      const searchInput = page.locator('input[type="text"]').first();
      await expect(searchInput).toBeVisible();
      await searchInput.fill('Boulogne');

      const result = page
        .locator('div.cursor-pointer', { hasText: 'Boulogne-Billancourt' })
        .first();
      await expect(result).toBeVisible({ timeout: 15000 });
      await result.click();

      // The selected location's live weather card is displayed.
      await expect(page.locator('text=°C').first()).toBeVisible({ timeout: 15000 });
    });

    // 2. The visitor registers a new account.
    await test.step('Visitor registers', async () => {
      await page.locator('a[href="/register"]').first().click();
      await expect(page).toHaveURL(/\/register$/);

      await page.locator('input[type="text"]').fill(USERNAME);
      await page.locator('input[type="email"]').fill(EMAIL);
      await page.locator('input[type="password"]').fill(INITIAL_PASSWORD);
      await page.locator('button[type="submit"]').click();

      await expect(page).toHaveURL(/\/account$/);
      await expect(page.getByRole('heading', { name: 'My Account' })).toBeVisible();

      // Reload so the shared AuthProvider re-reads the session and the header
      // exposes the Logout action (the register page does not refresh it).
      await page.reload();
      await expect(page.getByRole('heading', { name: 'My Account' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    });

    // 3. The new user adds two favorites.
    await test.step('Adds two favorite locations', async () => {
      const addInput = page.getByPlaceholder('Enter a city to add as favorite');

      await addInput.fill('Paris');
      await page.getByRole('button', { name: 'Search' }).click();
      const parisResult = page.locator('div.flex.justify-between', { hasText: 'Paris, FR' });
      await expect(parisResult).toBeVisible({ timeout: 10000 });
      await parisResult.getByRole('button', { name: 'Add' }).click();
      await expect(page.locator('li', { hasText: 'Paris' })).toBeVisible();

      await addInput.fill('Lyon');
      await page.getByRole('button', { name: 'Search' }).click();
      const lyonResult = page.locator('div.flex.justify-between', { hasText: 'Lyon, FR' });
      await expect(lyonResult).toBeVisible({ timeout: 10000 });
      await lyonResult.getByRole('button', { name: 'Add' }).click();
      await expect(page.locator('li', { hasText: 'Lyon' })).toBeVisible();

      await expect(page.locator('ul li')).toHaveCount(2);
    });

    // 4. The user changes the account password.
    await test.step('Changes the account password', async () => {
      await page.getByRole('button', { name: 'Change My Password' }).click();
      await page.locator('#newPassword').fill(UPDATED_PASSWORD);
      await page.locator('#confirmPassword').fill(UPDATED_PASSWORD);
      await page.getByRole('button', { name: 'Save Password' }).click();
      await expect(page.getByText('Password changed successfully!')).toBeVisible();
    });

    // 5. The user removes one favorite.
    await test.step('Removes one favorite', async () => {
      const parisRow = page.locator('li', { hasText: 'Paris' });
      await expect(parisRow).toBeVisible();
      await parisRow.getByRole('button', { name: 'Remove' }).click();

      await expect(page.locator('li', { hasText: 'Paris' })).toHaveCount(0);
      await expect(page.locator('li', { hasText: 'Lyon' })).toBeVisible();
    });

    // 6. The user logs out.
    await test.step('Logs out', async () => {
      await page.getByRole('button', { name: 'Logout' }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    });

    // 7. The user logs back in with the updated password.
    await test.step('Logs back in with the new password', async () => {
      await page.getByRole('button', { name: 'Login' }).click();
      const modal = page
        .locator('div.fixed.inset-0')
        .filter({ has: page.getByRole('heading', { name: 'Login' }) });
      const usernameInput = modal.locator('input[type="text"]');
      const passwordInput = modal.locator('input[type="password"]');

      // The old password must no longer work after the password change.
      await usernameInput.fill(USERNAME);
      await passwordInput.fill(INITIAL_PASSWORD);
      await modal.getByRole('button', { name: 'Login' }).click();
      await expect(modal.getByText('Invalid credentials')).toBeVisible();

      // The updated password restores the session and the remaining favorite.
      await passwordInput.fill(UPDATED_PASSWORD);
      await modal.getByRole('button', { name: 'Login' }).click();
      await expect(page).toHaveURL(/\/account$/);
      await expect(page.getByRole('heading', { name: 'My Account' })).toBeVisible();
      await expect(page.locator('li', { hasText: 'Lyon' })).toBeVisible();
      await expect(page.locator('li', { hasText: 'Paris' })).toHaveCount(0);
    });
  });
});
