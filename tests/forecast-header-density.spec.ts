import { test, expect, Page } from '@playwright/test';

// Regression guard for the mobile forecast day-header rows (the "Next hours",
// "Tomorrow", "Wednesday"... lines of the weather forecast box). The label,
// the daily weather icon and the min/max temperatures were slightly enlarged
// for readability, so the vertical paddings/margins around them were trimmed
// at the same time to keep each row from growing taller. This measures the
// real computed font sizes and the row height so the two changes cannot
// silently drift apart.

const now = Math.floor(Date.now() / 1000);

const PARIS = {
  _id: 'fav-paris',
  user_id: 'u1',
  location_name: 'Paris',
  latitude: 48.8566,
  longitude: 2.3522,
  country_code: 'FR',
  order: 0,
};

async function installFakeBackend(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('auth_token', '1'));
  await page.route('**/sw.js', (route) => route.abort());
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const send = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathname === '/api/check-auth') return send({ isAuthenticated: true });
    if (pathname === '/api/favorites') return send([PARIS]);
    if (pathname === '/api/cached-favorites') return send([]);
    if (pathname === '/api/onecall')
      return send({
        current: { temp: 20, feels_like: 19, humidity: 55, pressure: 1013, weather: [{ description: 'clear sky', icon: '01d' }], wind_speed: 3, wind_deg: 180, clouds: 5, visibility: 10000, sunrise: now - 3600, sunset: now + 3600 },
        daily: [{ rain: 0, snow: 0 }],
        timezone: 'Europe/Paris',
        timezone_offset: 3600,
      });
    if (pathname === '/api/forecast') {
      // Several days so the forecast box shows multiple expandable day rows.
      const list = Array.from({ length: 96 }, (_, i) => ({
        dt: now + i * 3600,
        main: { temp: 20, temp_min: 18, temp_max: 22 },
        weather: [{ icon: '01d', description: 'clear sky' }],
      }));
      return send({ list, timezone: 'Europe/Paris' });
    }
    if (pathname === '/api/onecallmonthsummary') return send([]);
    return send({});
  });
}

test.describe('Mobile forecast day-header density', () => {
  test('enlarges the label/icon/temperature text while keeping day rows compact', async ({ page }) => {
    test.setTimeout(60_000);
    await installFakeBackend(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('heading', { name: /Paris/ }).first().waitFor({ timeout: 15000 });

    // Scope to the weather forecast box and grab its expandable day headers.
    const forecastCard = page.locator('h2', { hasText: /Weather Forecast/i }).locator('..');
    const dayHeaders = forecastCard.locator('div[role="button"][aria-expanded]');
    await expect(dayHeaders.first()).toBeVisible({ timeout: 15000 });

    const metrics = await dayHeaders.first().evaluate((row) => {
      const label = row.querySelector('h3') as HTMLElement | null;
      const tempSpan = Array.from(row.querySelectorAll('span')).find((s) =>
        (s.textContent || '').includes('°C')
      ) as HTMLElement | undefined;
      return {
        labelFontSize: label ? parseFloat(getComputedStyle(label).fontSize) : 0,
        tempFontSize: tempSpan ? parseFloat(getComputedStyle(tempSpan).fontSize) : 0,
        rowHeight: Math.round(row.getBoundingClientRect().height),
      };
    });

    // Enlarged text: the day label and the min/max temperature.
    expect(metrics.labelFontSize).toBeGreaterThanOrEqual(18);
    expect(metrics.tempFontSize).toBeGreaterThanOrEqual(16);
    // Compensated by the trimmed paddings/margins: the row must not grow.
    expect(metrics.rowHeight).toBeLessThanOrEqual(52);
  });
});
