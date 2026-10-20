import { test, expect, Page } from '@playwright/test';

const PARIS = {
  _id: 'fav-paris',
  user_id: 'u1',
  location_name: 'Paris',
  latitude: 48.8566,
  longitude: 2.3522,
  country_code: 'FR',
  order: 0,
};

interface MinutelyTestSlot {
  dt: number;
  precipitation: number;
  rain: number;
  snowfall: number;
}

async function installFakeBackend(page: Page, minutely15: MinutelyTestSlot[]) {
  const now = Math.floor(Date.now() / 1000);
  await page.addInitScript(() => window.localStorage.setItem('auth_token', '1'));
  await page.route('**/sw.js', (route) => route.abort());
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const send = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathname === '/api/check-auth') return send({ isAuthenticated: true });
    if (pathname === '/api/favorites') return send([PARIS]);
    if (pathname === '/api/cached-favorites') return send([]);
    if (pathname === '/api/onecall') {
      return send({
        current: {
          temp: 14.5,
          feels_like: 13.0,
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
        minutely_15: minutely15,
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

test.describe('Next-hour 15-minute rain forecast in top weather card', () => {
  test('renders 4 upcoming 15-minute slots on desktop when rain is expected and supports i18n', async ({ page }) => {
    const now = Math.floor(Date.now() / 1000);
    const quarterStart = Math.floor(now / 900) * 900;
    const rainySlots: MinutelyTestSlot[] = [
      { dt: quarterStart, precipitation: 0.4, rain: 0.4, snowfall: 0 },
      { dt: quarterStart + 900, precipitation: 1.2, rain: 1.2, snowfall: 0 },
      { dt: quarterStart + 1800, precipitation: 0.0, rain: 0.0, snowfall: 0 },
      { dt: quarterStart + 2700, precipitation: 0.7, rain: 0.7, snowfall: 0 },
      { dt: quarterStart + 3600, precipitation: 2.5, rain: 2.5, snowfall: 0 },
    ];

    await installFakeBackend(page, rainySlots);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Click the favorite card on desktop to expand its WeatherDisplay card
    const favButton = page.getByRole('button', { name: /Paris/ }).first();
    await expect(favButton).toBeVisible({ timeout: 15000 });
    await favButton.click();

    const rainBlock = page.locator('[data-testid="next-hour-precipitation"]:visible');
    await expect(rainBlock).toBeVisible({ timeout: 15000 });
    await expect(rainBlock).toContainText('Rain in the next hour');

    // The 24-hour total coming from MET Norway must be explicitly labelled
    // instead of showing a bare "2.3 mm" figure in the conditions grid.
    // Mobile carousel slides are also in the DOM but hidden on desktop.
    const rain24h = page.locator('[data-testid="rain-next-24h"]:visible').first();
    await expect(rain24h).toBeVisible();
    await expect(rain24h).toContainText('Rain next 24 h');
    await expect(rain24h).toContainText('2.3 mm');
    await expect(rain24h).toHaveAttribute('title', 'Total rain expected over the next 24 hours');

    // The section header sums the 4 displayed quarter-hour slots.
    const nextHourTotal = rainBlock.getByTestId('next-hour-rain-total');
    await expect(nextHourTotal).toContainText('2.3 mm');
    await expect(nextHourTotal).toHaveAttribute('title', 'Total precipitation expected in the next hour');

    const slots = rainBlock.getByTestId('next-hour-rain-slot');
    await expect(slots).toHaveCount(4);
    await expect(slots.nth(0)).toContainText('0.4 mm');
    await expect(slots.nth(1)).toContainText('1.2 mm');
    await expect(slots.nth(2)).toContainText('0.0 mm');
    await expect(slots.nth(3)).toContainText('0.7 mm');

    // Each slot exposes its exact quarter-hour window.
    for (let i = 0; i < 4; i += 1) {
      await expect(slots.nth(i)).toHaveAttribute('title', /^\d{2}:\d{2} – \d{2}:\d{2} · \d+\.\d mm$/);
    }

    // Switch language to French and verify title + 'h' time format
    const langSelect = page.locator('header select').first();
    await langSelect.selectOption('fr');
    await expect(rainBlock).toContainText("Pluie dans l'heure");
    await expect(rain24h).toContainText('Pluie sur 24 h');
    await expect(rain24h).toHaveAttribute('title', 'Cumul de pluie prévu sur les prochaines 24 heures');
    await expect(slots.nth(0)).toContainText(/h/);
    await expect(slots.nth(0)).toHaveAttribute('title', /^\d{2}h\d{2} – \d{2}h\d{2} · \d+\.\d mm$/);

    // Switch language to Spanish
    await langSelect.selectOption('es');
    await expect(rainBlock).toContainText('Lluvia en la próxima hora');
    await expect(rain24h).toContainText('Lluvia en 24 h');
  });

  test('renders the 4 next-hour slots on mobile carousel when rain is expected', async ({ page }) => {
    const now = Math.floor(Date.now() / 1000);
    const quarterStart = Math.floor(now / 900) * 900;
    const rainySlots: MinutelyTestSlot[] = [
      { dt: quarterStart, precipitation: 0.0, rain: 0.0, snowfall: 0 },
      { dt: quarterStart + 900, precipitation: 0.8, rain: 0.8, snowfall: 0 },
      { dt: quarterStart + 1800, precipitation: 1.5, rain: 1.5, snowfall: 0 },
      { dt: quarterStart + 2700, precipitation: 0.2, rain: 0.2, snowfall: 0 },
    ];

    await installFakeBackend(page, rainySlots);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const rainBlock = page.getByTestId('next-hour-precipitation').first();
    await expect(rainBlock).toBeVisible({ timeout: 15000 });

    const slots = rainBlock.getByTestId('next-hour-rain-slot');
    await expect(slots).toHaveCount(4);
    await expect(slots.nth(1)).toContainText('0.8 mm');
    await expect(slots.nth(2)).toContainText('1.5 mm');
  });

  test('hides the next-hour rain section when no precipitation is expected in the next 4 slots', async ({ page }) => {
    const now = Math.floor(Date.now() / 1000);
    const quarterStart = Math.floor(now / 900) * 900;
    const drySlots: MinutelyTestSlot[] = [
      { dt: quarterStart, precipitation: 0, rain: 0, snowfall: 0 },
      { dt: quarterStart + 900, precipitation: 0, rain: 0, snowfall: 0 },
      { dt: quarterStart + 1800, precipitation: 0, rain: 0, snowfall: 0 },
      { dt: quarterStart + 2700, precipitation: 0, rain: 0, snowfall: 0 },
    ];

    await installFakeBackend(page, drySlots);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Paris/ }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('next-hour-precipitation')).toHaveCount(0);
  });
});
