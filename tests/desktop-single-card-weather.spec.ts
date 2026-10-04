import { test, expect, Page } from '@playwright/test';

// Desktop viewport: test the desktop-specific single card expansion and scroll behavior
test.use({ viewport: { width: 1280, height: 800 } });

interface FakeFavorite {
  _id: string;
  user_id: string;
  location_name: string;
  latitude: number;
  longitude: number;
  country_code: string;
  order: number;
}

const PARIS: FakeFavorite = {
  _id: 'fav-paris',
  user_id: 'user_1',
  location_name: 'Paris',
  latitude: 48.8566,
  longitude: 2.3522,
  country_code: 'FR',
  order: 0,
};

const NICE: FakeFavorite = {
  _id: 'fav-nice',
  user_id: 'user_1',
  location_name: 'Nice',
  latitude: 43.7102,
  longitude: 7.262,
  country_code: 'FR',
  order: 1,
};

function fakeOneCall(cityName = 'Paris') {
  const now = Math.floor(Date.now() / 1000);
  return {
    name: cityName,
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

async function setupBackend(page: Page, favorites: FakeFavorite[] = [PARIS, NICE]) {
  await page.addInitScript(() => window.localStorage.setItem('auth_token', '1'));
  await page.route('**/sw.js', (route) => route.abort());

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const { pathname, searchParams } = new URL(request.url());
    const method = request.method();
    const send = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathname === '/api/check-auth' && method === 'POST') {
      return send({ isAuthenticated: true, user: { id: 'user_1', username: 'testuser' } });
    }
    if (pathname === '/api/favorites' && method === 'GET') {
      return send([...favorites].sort((a, b) => a.order - b.order));
    }
    if (pathname === '/api/search' && method === 'GET') {
      const city = (searchParams.get('city') || '').toLowerCase();
      if (city.includes('lyon')) {
        return send([
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
        ]);
      }
      return send([]);
    }
    if (pathname === '/api/cached-favorites' && method === 'GET') {
      return send([]);
    }
    if (pathname === '/api/onecall' && method === 'GET') {
      const lat = parseFloat(searchParams.get('lat') || '0');
      const name = Math.abs(lat - 45.764) < 0.1 ? 'Lyon' : Math.abs(lat - 43.7102) < 0.1 ? 'Nice' : 'Paris';
      return send(fakeOneCall(name));
    }
    if (pathname === '/api/forecast' && method === 'GET') {
      return send(fakeForecast());
    }
    if (pathname === '/api/onecallmonthsummary' && method === 'GET') {
      return send([]);
    }
    return send({ error: 'Not found' }, 404);
  });
}

test.describe('Desktop single-card weather display & scroll management', () => {
  test('Current location is not duplicated in the search card if already in favorites', async ({ page }) => {
    // Seed last location in localStorage as Paris (which is also in the favorites list)
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'lastSelectedLocation',
        JSON.stringify({ name: 'Paris', country: 'FR', lat: 48.8566, lon: 2.3522, location_name: 'Paris' })
      );
    });

    await setupBackend(page);
    await page.goto('/');

    // Favorites cards are rendered
    const parisFavCard = page.locator('[data-favorite-id="fav-paris"]');
    const niceFavCard = page.locator('[data-favorite-id="fav-nice"]');
    await expect(parisFavCard).toBeVisible({ timeout: 15000 });
    await expect(niceFavCard).toBeVisible();

    // The search weather card below the search bar must NOT be displayed because Paris is already in favorites
    const dismissSearchButton = page.locator('button[aria-label="Dismiss"]');
    await expect(dismissSearchButton).toHaveCount(0);

    // Clicking Paris favorite card expands it
    await parisFavCard.locator('[role="button"]').first().click();
    await expect(parisFavCard.locator('text=Next hours')).toBeVisible({ timeout: 15000 });
  });

  test('Only one card is open at any time between favorites and search card', async ({ page }) => {
    await setupBackend(page);
    await page.goto('/');

    const parisFavCard = page.locator('[data-favorite-id="fav-paris"]');
    const niceFavCard = page.locator('[data-favorite-id="fav-nice"]');
    await expect(parisFavCard).toBeVisible({ timeout: 15000 });
    await expect(niceFavCard).toBeVisible();

    // Step 1: Expand Paris favorite card
    await parisFavCard.locator('[role="button"]').first().click();
    await expect(parisFavCard.locator('text=Next hours')).toBeVisible({ timeout: 15000 });
    expect(await parisFavCard.locator('[role="button"]').first().getAttribute('aria-expanded')).toBe('true');

    // Step 2: Search for Lyon and select it from search results
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill('Lyon');
    const searchButton = page.locator('button', { hasText: /search/i }).first();
    await searchButton.click();

    const lyonResult = page.locator('div.cursor-pointer', { hasText: /Lyon/i }).first();
    await expect(lyonResult).toBeVisible({ timeout: 15000 });
    await lyonResult.click();

    // The search weather card appears with Lyon
    const dismissSearchButton = page.locator('button[aria-label="Dismiss"]');
    await expect(dismissSearchButton).toBeVisible({ timeout: 15000 });
    await expect(page.locator('h2', { hasText: 'Lyon' })).toBeVisible();

    // The Paris favorite card MUST be automatically collapsed (only one card open rule)
    await expect(parisFavCard.locator('[role="button"]').first()).toHaveAttribute('aria-expanded', 'false');
    await expect(parisFavCard.locator('text=Next hours')).toHaveCount(0);

    // Step 3: Now click Nice favorite card
    await niceFavCard.locator('[role="button"]').first().click();
    await expect(niceFavCard.locator('text=Next hours')).toBeVisible({ timeout: 15000 });
    await expect(niceFavCard.locator('[role="button"]').first()).toHaveAttribute('aria-expanded', 'true');

    // The Lyon search card MUST be dismissed/removed (only one card open rule)
    await expect(dismissSearchButton).toHaveCount(0);
    await expect(page.locator('h2', { hasText: 'Lyon' })).toHaveCount(0);

    // Step 4: Now click Paris favorite card
    await parisFavCard.locator('[role="button"]').first().click();
    await expect(parisFavCard.locator('text=Next hours')).toBeVisible({ timeout: 15000 });
    await expect(parisFavCard.locator('[role="button"]').first()).toHaveAttribute('aria-expanded', 'true');

    // Nice favorite card MUST be collapsed
    await expect(niceFavCard.locator('[role="button"]').first()).toHaveAttribute('aria-expanded', 'false');
    await expect(niceFavCard.locator('text=Next hours')).toHaveCount(0);
  });

  test('Page scroll positions the expanded favorite card comfortably in view', async ({ page }) => {
    // Use a standard laptop viewport height where page content extends past the fold
    await page.setViewportSize({ width: 1280, height: 600 });
    await setupBackend(page);
    await page.goto('/');

    const parisFavCard = page.locator('[data-favorite-id="fav-paris"]');
    const niceFavCard = page.locator('[data-favorite-id="fav-nice"]');
    await expect(parisFavCard).toBeVisible({ timeout: 15000 });
    await expect(niceFavCard).toBeVisible();

    // 1. Expand Paris favorite card first (making the page tall and scrollable)
    await parisFavCard.locator('[role="button"]').first().click();
    await expect(parisFavCard.locator('text=Next hours')).toBeVisible({ timeout: 15000 });

    // 2. Simulate user scrolling down into the expanded content
    await page.evaluate(() => {
      const scroller = document.scrollingElement || document.documentElement || document.body;
      scroller.scrollTop = 250;
      if (document.body) {
        document.body.scrollTop = 250;
      }
    });

    // 3. Click to expand Nice favorite card (collapsing Paris above it)
    await niceFavCard.locator('[role="button"]').first().click();
    await expect(niceFavCard.locator('text=Next hours')).toBeVisible({ timeout: 15000 });
    await expect(parisFavCard.locator('[role="button"]').first()).toHaveAttribute('aria-expanded', 'false');

    // 4. Verify Nice is smoothly repositioned comfortably within view near the top of the viewport
    await expect(async () => {
      const cardRectTop = await niceFavCard.evaluate((el) => el.getBoundingClientRect().top);
      expect(cardRectTop).toBeGreaterThanOrEqual(-10);
      expect(cardRectTop).toBeLessThanOrEqual(150);
    }).toPass({ timeout: 5000 });
  });
});
