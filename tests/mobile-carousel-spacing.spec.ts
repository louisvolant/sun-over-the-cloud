import { test, expect, Page } from '@playwright/test';

// Regression guard for the mobile location carousel: the slide used to add a
// `pb-6` on top of the page-dots row padding, which doubled the empty gap
// between the weather content and the dots (visible mostly in PWA mode, where
// the carousel is full-height). This measures the real gap with an overflowing
// card scrolled to its bottom.

const now = Math.floor(Date.now() / 1000);

const PARIS = { _id: 'fav-paris', user_id: 'u1', location_name: 'Paris', latitude: 48.8566, longitude: 2.3522, country_code: 'FR', order: 0 };
const NICE = { _id: 'fav-nice', user_id: 'u1', location_name: 'Nice', latitude: 43.7102, longitude: 7.262, country_code: 'FR', order: 1 };

async function installFakeBackend(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('auth_token', '1'));
  await page.route('**/sw.js', (route) => route.abort());
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const send = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathname === '/api/check-auth') return send({ isAuthenticated: true });
    if (pathname === '/api/favorites') return send([PARIS, NICE]);
    if (pathname === '/api/cached-favorites') return send([]);
    if (pathname === '/api/onecall')
      return send({
        current: { temp: 20, feels_like: 19, humidity: 55, pressure: 1013, weather: [{ description: 'clear sky', icon: '01d' }], wind_speed: 3, wind_deg: 180, clouds: 5, visibility: 10000, sunrise: now - 3600, sunset: now + 3600 },
        daily: [{ rain: 0, snow: 0 }],
        timezone: 'Europe/Paris',
        timezone_offset: 3600,
      });
    if (pathname === '/api/forecast') {
      // Plenty of days so the slide content overflows and can be scrolled.
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

test.describe('Mobile location carousel spacing', () => {
  test('keeps a small gap between the weather card and the page dots', async ({ page }) => {
    test.setTimeout(60_000);
    await installFakeBackend(page);
    await page.setViewportSize({ width: 390, height: 600 });
    await page.goto('/');
    await page.getByRole('heading', { name: 'Paris', exact: true }).waitFor({ timeout: 15000 });

    const gap = await page.evaluate(() => {
      const root = document.querySelector('div.flex.flex-col.h-full');
      const dots = root ? (root.children[1] as HTMLElement | null) : null;
      const scrollArea = root?.querySelector('div.snap-center div.overflow-y-auto') as HTMLElement | null;
      if (!dots || !scrollArea) return null;

      scrollArea.scrollTop = scrollArea.scrollHeight;
      const lastContent = scrollArea.lastElementChild as HTMLElement | null;
      if (!lastContent) return null;

      return Math.round(dots.getBoundingClientRect().top - lastContent.getBoundingClientRect().bottom);
    });

    expect(gap).not.toBeNull();
    // With the old `pb-6` this was ~24px; it must now stay small.
    expect(gap as number).toBeLessThanOrEqual(12);
  });
});
