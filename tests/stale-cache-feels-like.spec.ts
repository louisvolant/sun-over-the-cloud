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

test.describe('Stale IndexedDB cache projection', () => {
  test('recomputes feels_like with humidity and wind when projecting stale cache (>2h)', async ({ page }) => {
    const nowSec = Math.floor(Date.now() / 1000);
    const threeHoursAgoMs = Date.now() - 3 * 3600 * 1000;

    await page.addInitScript(
      ({ fav, savedAt, now }) => {
        window.localStorage.setItem('auth_token', '1');
        const req = window.indexedDB.open('sun_over_the_cloud_pwa_db', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('weather_cache')) {
            db.createObjectStore('weather_cache', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('favorites_cache')) {
            db.createObjectStore('favorites_cache', { keyPath: 'key' });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('weather_cache', 'readwrite');
          const store = tx.objectStore('weather_cache');
          const key = `coord_${fav.latitude.toFixed(3)}_${fav.longitude.toFixed(3)}`;
          store.put({
            key,
            savedAt,
            location: {
              name: fav.location_name,
              country: fav.country_code,
              lat: fav.latitude,
              lon: fav.longitude,
            },
            rainFalls: 2.5,
            snowDepth: null,
            weather: {
              name: fav.location_name,
              country: fav.country_code,
              main: { temp: 15.0, feels_like: 14.0, humidity: 88.9, pressure: 1012 },
              weather: [{ description: 'overcast clouds', icon: '04d' }],
              wind: { speed: 7.4, deg: 197 },
              clouds: { all: 100 },
              visibility: 10000,
              coord: { lat: fav.latitude, lon: fav.longitude },
              timezone: 'Europe/Paris',
              timezone_offset: 3600,
              sys: { sunrise: now - 3600, sunset: now + 3600 },
              minutely_15: [],
            },
            forecast: {
              list: [
                {
                  dt: now + 600,
                  main: { temp: 10.2 },
                  weather: [{ id: 502, main: 'Rain', description: 'heavy intensity rain', icon: '10d' }],
                },
              ],
            },
          });
        };
      },
      { fav: PARIS, savedAt: threeHoursAgoMs, now: nowSec }
    );

    await page.route('**/sw.js', (route) => route.abort());
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      const send = (body: unknown, status = 200) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathname === '/api/check-auth') return send({ isAuthenticated: true });
      if (pathname === '/api/favorites') return send([PARIS]);
      if (pathname === '/api/cached-favorites') return send([]);
      // Simulate offline / delayed live weather so the stale projected cache remains visible.
      if (pathname === '/api/onecall' || pathname === '/api/forecast') {
        return route.abort();
      }
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const favButton = page.getByRole('button', { name: /Paris/ }).first();
    await expect(favButton).toBeVisible({ timeout: 15000 });
    await favButton.click();

    await expect(page.locator('span:has-text("10.2°C"):visible').first()).toBeVisible();
    // Steadman apparent temp for 10.2°C, 88.9% RH, 7.4 m/s wind is 4.7°C (not 10.2°C).
    await expect(page.locator('span:has-text("(4.7°C feels like)"):visible').first()).toBeVisible();
  });
});
