import { test, expect } from '@playwright/test';

const authenticatedUser = {
  isAuthenticated: true,
  user: { id: 'test-user-id', username: 'testuser' },
};

const multipleResults = [
  {
    name: 'Boulogne-sur-Mer',
    lat: 50.7264,
    lon: 1.6147,
    country: 'FR',
    state: 'Hauts-de-France',
    location_name: 'Boulogne-sur-Mer, Hauts-de-France',
  },
  {
    name: 'Boulogne-Billancourt',
    lat: 48.8352,
    lon: 2.2409,
    country: 'FR',
    state: 'Ile-de-France',
    location_name: 'Boulogne-Billancourt, Ile-de-France',
  },
];

async function mockAuthenticatedSearchPage(page: import('@playwright/test').Page) {
  await page.route('**/api/check-auth', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(authenticatedUser),
    });
  });
  await page.route('**/api/search*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(multipleResults),
    });
  });
  await page.route('**/api.bigdatacloud.net/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ city: 'Boulogne-Billancourt', countryCode: 'FR' }),
    });
  });
}

test.describe('Search page geolocation', () => {
  test('Use my location keeps the selected location visible on the search page', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 48.8352, longitude: 2.2409 });
    await mockAuthenticatedSearchPage(page);

    await page.goto('/search');

    const input = page.locator('input[type="text"]');
    await input.fill('Boulogne');

    // Wait for the debounced search results to render.
    await expect(
      page.locator('div.cursor-pointer', { hasText: /Boulogne/ }).first()
    ).toBeVisible({ timeout: 20000 });

    // Tap the map-pin "Use my location" action.
    await page.getByRole('button', { name: /use my location|utiliser ma position/i }).click();

    // The reverse-geocoded position is selected and the input is cleared.
    await expect(page.getByText('Boulogne-Billancourt, FR')).toBeVisible({ timeout: 20000 });
    await expect(input).toHaveValue('');

    // The selection must survive the debounced cleanup that follows the clear:
    // the panel is still there after the debounce delay.
    await page.waitForTimeout(1200);
    await expect(page.getByText('Boulogne-Billancourt, FR')).toBeVisible();
  });

  test('Typing a query does not trigger repeated searches', async ({ page }) => {
    let searchRequests = 0;
    await page.route('**/api/check-auth', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(authenticatedUser),
      });
    });
    await page.route('**/api/search*', async (route) => {
      searchRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(multipleResults),
      });
    });

    await page.goto('/search');
    await page.locator('input[type="text"]').fill('Boulogne');

    // A single debounced search is expected. Before the fix the effect re-ran
    // on every render and fired a new request roughly every 500ms.
    await page.waitForTimeout(2500);
    expect(searchRequests).toBeLessThanOrEqual(2);
  });
});
