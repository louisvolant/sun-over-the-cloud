import { test, expect, Page } from '@playwright/test';

const SAINT_MAUR = {
  _id: 'fav-saint-maur',
  user_id: 'u1',
  location_name: 'Saint-Maur-des-Fossés',
  latitude: 48.8028,
  longitude: 2.4975,
  country_code: 'FR',
  order: 0,
};

/**
 * Dev comment:
 * Regression tests for the top line of the current-conditions card.
 *
 * The location name used to live inside the left column, next to the desktop
 * details column. Because that details column is sized by its nowrap content,
 * it squeezed the left column down to its 260px minimum on md+ screens, which
 * truncated long names (e.g. "Saint-Maur-des-Fossés") even at 1280px wide.
 * The line now spans the full card width, and the dismiss button is rendered
 * next to the favorite button instead of being absolutely positioned on top
 * of it.
 */
async function setupBackend(page: Page, authenticated = false) {
  const now = Math.floor(Date.now() / 1000);
  const quarterStart = Math.floor(now / 900) * 900;

  await page.addInitScript(() => {
    if (!window.localStorage.getItem('auth_token')) {
      window.localStorage.setItem(
        'lastSelectedLocation',
        JSON.stringify({
          name: 'Saint-Maur-des-Fossés',
          country: 'FR',
          lat: 48.8028,
          lon: 2.4975,
          location_name: 'Saint-Maur-des-Fossés',
        })
      );
    }
  });
  if (authenticated) {
    await page.addInitScript(() => window.localStorage.setItem('auth_token', '1'));
  }

  await page.route('**/sw.js', (route) => route.abort());
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const send = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathname === '/api/check-auth') {
      return send({
        isAuthenticated: authenticated,
        user: authenticated ? { id: 'u1', username: 'testuser' } : undefined,
      });
    }
    if (pathname === '/api/favorites') return send(authenticated ? [SAINT_MAUR] : []);
    if (pathname === '/api/cached-favorites') return send([]);
    if (pathname === '/api/search') return send([]);
    if (pathname === '/api/onecall') {
      return send({
        current: {
          temp: 14.8,
          feels_like: 9.3,
          humidity: 57,
          weather: [{ description: 'light intensity shower rain', icon: '10d' }],
          wind_speed: 6.6,
          wind_deg: 255.8,
          clouds: 18,
          visibility: 10000,
          sunrise: now - 3600,
          sunset: now + 3600,
        },
        daily: [{ rain: 1.0, snow: 0 }],
        minutely_15: [
          { dt: quarterStart, precipitation: 0, rain: 0, snowfall: 0 },
          { dt: quarterStart + 900, precipitation: 0, rain: 0, snowfall: 0 },
          { dt: quarterStart + 1800, precipitation: 0, rain: 0, snowfall: 0 },
          { dt: quarterStart + 2700, precipitation: 1.0, rain: 1.0, snowfall: 0 },
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
}

async function expectLocationNameNotTruncated(page: Page) {
  const name = page.locator('h2:visible span.truncate', { hasText: 'Saint-Maur-des-Fossés' }).first();
  await expect(name).toBeVisible({ timeout: 15000 });
  const { scrollWidth, clientWidth } = await name.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
}

test.describe('Current conditions card: location line layout', () => {
  for (const width of [1024, 1280]) {
    test(`keeps the full location name and separates favorite/dismiss actions at ${width}px`, async ({
      page,
    }) => {
      await setupBackend(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      await expectLocationNameNotTruncated(page);

      const favoriteButton = page.getByRole('button', { name: 'Add to favorites' }).first();
      const dismissButton = page.getByRole('button', { name: 'Dismiss' }).first();
      await expect(favoriteButton).toBeVisible();
      await expect(dismissButton).toBeVisible();

      const favoriteBox = await favoriteButton.boundingBox();
      const dismissBox = await dismissButton.boundingBox();
      expect(favoriteBox).not.toBeNull();
      expect(dismissBox).not.toBeNull();
      // The dismiss action sits next to the favorite action, never on top of it.
      expect(favoriteBox!.x + favoriteBox!.width).toBeLessThanOrEqual(dismissBox!.x);
    });
  }

  test('does not truncate the location name in an expanded desktop favorite card', async ({ page }) => {
    await setupBackend(page, true);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const favoriteCard = page.getByRole('button', { name: /Saint-Maur-des-Fossés/ }).first();
    await expect(favoriteCard).toBeVisible({ timeout: 15000 });
    await favoriteCard.click();

    await expectLocationNameNotTruncated(page);
  });
});
