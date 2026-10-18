import { test, expect, Page } from '@playwright/test';

const FAVORITES_THREE = [
  {
    _id: 'fav-paris',
    user_id: 'u1',
    location_name: 'Paris',
    latitude: 48.8566,
    longitude: 2.3522,
    country_code: 'FR',
    order: 0,
  },
  {
    _id: 'fav-lyon',
    user_id: 'u1',
    location_name: 'Lyon',
    latitude: 45.764,
    longitude: 4.8357,
    country_code: 'FR',
    order: 1,
  },
  {
    _id: 'fav-marseille',
    user_id: 'u1',
    location_name: 'Marseille',
    latitude: 43.2965,
    longitude: 5.3698,
    country_code: 'FR',
    order: 2,
  },
];

async function installFakeBackend(
  page: Page,
  options: { isAuthenticated: boolean; favorites: typeof FAVORITES_THREE }
) {
  const now = Math.floor(Date.now() / 1000);
  if (options.isAuthenticated) {
    await page.addInitScript(() => window.localStorage.setItem('auth_token', '1'));
  }
  await page.route('**/sw.js', (route) => route.abort());
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;
    const send = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathname === '/api/check-auth') {
      return send({ isAuthenticated: options.isAuthenticated });
    }
    if (pathname === '/api/favorites') {
      return send(options.isAuthenticated ? options.favorites : []);
    }
    if (pathname === '/api/cached-favorites') {
      return send([]);
    }
    if (pathname === '/api/onecall') {
      const lat = parseFloat(url.searchParams.get('lat') || '48.85');
      const temp = lat < 44 ? 24.0 : lat < 46 ? 21.0 : 18.0;
      return send({
        current: {
          temp,
          feels_like: temp - 1,
          humidity: 55,
          pressure: 1015,
          weather: [{ description: 'clear sky', icon: '01d' }],
          wind_speed: 3,
          wind_deg: 180,
          clouds: 10,
          visibility: 10000,
          sunrise: now - 3600,
          sunset: now + 3600,
        },
        daily: [{ rain: 0, snow: 0 }],
        timezone: 'Europe/Paris',
        timezone_offset: 3600,
      });
    }
    if (pathname === '/api/forecast') {
      const list = Array.from({ length: 12 }, (_, i) => ({
        dt: now + i * 3600,
        main: { temp: 20, temp_min: 18, temp_max: 22 },
        weather: [{ icon: '01d', description: 'clear sky' }],
      }));
      return send({ list, timezone: 'Europe/Paris' });
    }
    if (pathname === '/api/onecallmonthsummary') {
      return send([]);
    }
    return send({});
  });
}

test.describe('Mobile sticky footer favorites list shortcut', () => {
  test('hides the favorites list icon when user has 2 or fewer favorites', async ({ page }) => {
    await installFakeBackend(page, {
      isAuthenticated: true,
      favorites: FAVORITES_THREE.slice(0, 2),
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Paris/ }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('mobile-footer-favorites')).toHaveCount(0);
  });

  test('shows the favorites list icon when user has > 2 favorites and jumps to the clicked location on Home', async ({
    page,
  }) => {
    await installFakeBackend(page, {
      isAuthenticated: true,
      favorites: FAVORITES_THREE,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // With 3 favorites, the list shortcut icon appears in the mobile sticky footer
    const favNavButton = page.getByTestId('mobile-footer-favorites');
    await expect(favNavButton).toBeVisible({ timeout: 15000 });

    // Clicking the icon navigates to the vertical favorites list page (/favorites)
    await favNavButton.click();
    await expect(page).toHaveURL(/\/favorites$/);

    const rows = page.getByTestId('mobile-favorite-list-item');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Paris');
    await expect(rows.nth(1)).toContainText('Lyon');
    await expect(rows.nth(2)).toContainText('Marseille');
    await expect(rows.nth(2)).toContainText('24.0°C');

    // Clicking Marseille navigates to Home and focuses the carousel on Marseille (index 2)
    await rows.nth(2).click();
    await expect(page).toHaveURL(/\/$/);

    const marseilleDot = page.locator('button[aria-label="Marseille"]');
    await expect(marseilleDot).toHaveAttribute('aria-current', 'true', { timeout: 10000 });
  });
});
