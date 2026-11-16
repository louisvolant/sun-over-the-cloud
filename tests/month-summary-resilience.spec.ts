import { test, expect } from '@playwright/test';

const PARIS = {
  _id: 'fav-paris',
  user_id: 'u1',
  location_name: 'Paris',
  latitude: 48.8566,
  longitude: 2.3522,
  country_code: 'FR',
  order: 0,
};

test.describe('Monthly summary resilience and retry', () => {
  test('displays error when monthly summary fails and recovers on retry', async ({ page }) => {
    const now = Math.floor(Date.now() / 1000);
    let summaryAttempts = 0;

    await page.addInitScript(() => window.localStorage.setItem('auth_token', '1'));
    await page.route('**/sw.js', (route) => route.abort());
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      const send = (body: unknown, status = 200) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathname === '/api/check-auth') return send({ isAuthenticated: true });
      if (pathname === '/api/favorites') return send([PARIS]);
      if (pathname === '/api/cached-favorites') return send([]);
      if (pathname === '/api/onecall') {
        return send({
          current: {
            temp: 12,
            feels_like: 10,
            humidity: 80,
            pressure: 1012,
            weather: [{ description: 'light rain', icon: '10d' }],
            wind_speed: 3,
            wind_deg: 180,
            clouds: 70,
            visibility: 10000,
            sunrise: now - 3600,
            sunset: now + 3600,
          },
          daily: [{ rain: 2.0, snow: 0 }],
          minutely_15: [],
          timezone: 'Europe/Paris',
          timezone_offset: 3600,
        });
      }
      if (pathname === '/api/forecast') {
        return send({ list: [], timezone: 'Europe/Paris' });
      }
      if (pathname === '/api/onecallmonthsummary') {
        summaryAttempts += 1;
        if (summaryAttempts === 1) {
          return send({ error: 'Failed to fetch monthly weather data' }, 500);
        }
        return send([
          {
            date: '2026-11-01',
            precipitation: { total: 4.2 },
            humidity: { afternoon: 78 },
            cloud_cover: { afternoon: 65 },
          },
        ]);
      }
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const favButton = page.getByRole('button', { name: /Paris/ }).first();
    await expect(favButton).toBeVisible({ timeout: 15000 });
    await favButton.click();

    const showGraphsBtn = page.getByRole('button', { name: /View Monthly Data/i }).first();
    await expect(showGraphsBtn).toBeVisible({ timeout: 10000 });
    await showGraphsBtn.click();

    await expect(page.getByText(/Failed to fetch monthly precipitation data/i).first()).toBeVisible({ timeout: 10000 });

    // Retry by clicking the button again once upstream recovers
    await showGraphsBtn.click();
    await expect(page.getByText(/Failed to fetch monthly precipitation data/i)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Monthly Precipitation/i }).first()).toBeVisible({ timeout: 10000 });
    expect(summaryAttempts).toBe(2);
  });
});
