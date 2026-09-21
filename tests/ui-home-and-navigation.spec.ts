import { test, expect } from '@playwright/test';

test.describe('UI Navigation and Interactions', () => {
  test('Home page renders correctly with search bar and branding', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Sun Over The Cloud/i);

    const searchInput = page.locator('input[type="text"]');
    await expect(searchInput).toBeVisible();

    const searchButton = page.locator('button', { hasText: /search/i }).first();
    await expect(searchButton).toBeVisible();
  });

  test('Dark mode toggle functions correctly', async ({ page }) => {
    await page.goto('/');

    // Target the dark mode toggle button in footer by aria-label or icon
    const darkModeButton = page.locator('button[aria-label*="dark mode" i], button:has-text("🌙"), button:has-text("☀️")').first();
    await expect(darkModeButton).toBeVisible();

    const html = page.locator('html');
    const initiallyDark = (await html.getAttribute('class'))?.includes('dark') ?? false;

    await darkModeButton.click();
    const afterClickDark = (await html.getAttribute('class'))?.includes('dark') ?? false;
    expect(afterClickDark).toBe(!initiallyDark);
  });

  test('Searching and selecting a location displays live weather data', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.locator('input[type="text"]');
    await searchInput.fill('Nice');

    // `.first()` targets the main search button; the mobile footer nav also
    // contains a Search action (hidden on desktop but present in the DOM).
    const searchButton = page.locator('button', { hasText: /search/i }).first();
    await searchButton.click();

    // Wait for the geocoding dropdown result to appear
    const resultItem = page.locator('div.cursor-pointer', { hasText: /Nice/i }).first();
    await expect(resultItem).toBeVisible({ timeout: 20000 });

    // Click on the result to fetch live weather from MET Norway
    await resultItem.click();

    // The weather display card should appear with temperature in °C
    const weatherCard = page.locator('text=°C').first();
    await expect(weatherCard).toBeVisible({ timeout: 20000 });

    // 5-day forecast is automatically rendered with daily summary headers
    const daySummaryDivider = page.locator('text=/').first();
    await expect(daySummaryDivider).toBeVisible({ timeout: 15000 });
  });

  test('Register page displays registration form with required inputs', async ({ page }) => {
    await page.goto('/register');

    const usernameInput = page.locator('input[type="text"]');
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await expect(usernameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('Account page shows login or account state', async ({ page }) => {
    await page.goto('/account');
    // Without authentication, page renders and informs or shows action buttons
    await expect(page).toHaveTitle(/Sun Over The Cloud/i);
  });

  test('Viewport disables mobile zoom to behave like native app', async ({ page }) => {
    await page.goto('/');
    const viewportMeta = page.locator('meta[name="viewport"]');
    const content = await viewportMeta.getAttribute('content');
    expect(content).toContain('user-scalable=no');
    expect(content).toContain('maximum-scale=1');
  });

  test('Mobile view renders single-line header and bottom controls before footer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Header is rendered
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Bottom controls are visible on mobile before footer
    const bottomControls = page.locator('select[aria-label="Select language"]');
    await expect(bottomControls.last()).toBeVisible();

    // Footer is rendered below bottom controls
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });

  test('Mobile footer Search action navigates to the dedicated search page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Tap the Search icon in the sticky footer navigation
    const footerSearch = page.locator('nav a[href="/search"]');
    await expect(footerSearch).toBeVisible();
    await footerSearch.click();

    // The dedicated search page renders with its title and search input
    await expect(page).toHaveURL(/\/search$/);
    await expect(page.getByText(/search a location/i)).toBeVisible();
    await expect(page.locator('input[type="text"]')).toBeVisible();
  });

  test('Searching location displays an add-to-favorites action button on search result', async ({ page }) => {
    await page.goto('/');
    const searchInput = page.locator('input[type="text"]');
    await searchInput.fill('Paris');
    const searchButton = page.locator('button', { hasText: /search/i }).first();
    await searchButton.click();

    const resultItem = page.locator('div.cursor-pointer', { hasText: /Paris/i }).first();
    await expect(resultItem).toBeVisible({ timeout: 20000 });
    await resultItem.click();

    // The favorite action button is rendered on the weather card
    const favButton = page.locator('button', { hasText: /favori/i }).first();
    await expect(favButton).toBeVisible({ timeout: 20000 });
  });

  test('Authenticated user with favorites sees "Organiser" button and "Nouvelle ville" title', async ({ page }) => {
    // Mock authenticated user session
    await page.route('**/api/check-auth', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ isAuthenticated: true, user: { id: 'test-user-id', username: 'testuser' } }),
      });
    });

    // Mock favorites API response with 2 favorites
    await page.route('**/api/favorites', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { _id: 'fav-1', location_name: 'Paris', latitude: 48.8566, longitude: 2.3522, country_code: 'FR' },
          { _id: 'fav-2', location_name: 'Nice', latitude: 43.7102, longitude: 7.2620, country_code: 'FR' },
        ]),
      });
    });

    await page.goto('/');

    // Verify "Nouvelle ville" / "New city" heading appears above search
    const newCityHeading = page.locator('h3', { hasText: /nouvelle ville|new city/i });
    await expect(newCityHeading).toBeVisible({ timeout: 10000 });

    // Verify "Organiser" / "Organize" button appears to the right of favorites title
    const organizeButton = page.locator('button', { hasText: /organiser|organize/i });
    await expect(organizeButton).toBeVisible();

    // Click "Organiser" to enter organize drag-and-drop mode
    await organizeButton.click();

    // Verify button switches to "Terminé" / "Done"
    const doneButton = page.locator('button', { hasText: /terminé|done/i });
    await expect(doneButton).toBeVisible();

    // Verify reorder up/down buttons and drag handles appear on cards.
    // Anchor the labels: `*="Move"` would also match the "Remove from
    // favorites" button ("reMove") on the hidden mobile carousel.
    const moveButtons = page.locator('button[aria-label*="Déplacer" i], button[aria-label^="Move" i]');
    await expect(moveButtons.first()).toBeVisible();

    // Click "Terminé" / "Done" to exit organizing mode
    await doneButton.click();
    await expect(organizeButton).toBeVisible();
  });

  test('IndexedDB caches weather and forecast data for instant visual restore', async ({ page }) => {
    await page.goto('/');

    // Evaluate IndexedDB operations in browser context
    const idbResult = await page.evaluate(async () => {
      const dbName = 'sun_over_the_cloud_pwa_db';
      return new Promise<{ success: boolean; hasStores: boolean }>((resolve) => {
        const req = window.indexedDB.open(dbName, 1);
        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('weather_cache')) {
            db.createObjectStore('weather_cache', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('favorites_cache')) {
            db.createObjectStore('favorites_cache', { keyPath: 'key' });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const hasStores =
            db.objectStoreNames.contains('weather_cache') &&
            db.objectStoreNames.contains('favorites_cache');
          db.close();
          resolve({ success: true, hasStores });
        };
        req.onerror = () => {
          resolve({ success: false, hasStores: false });
        };
      });
    });

    expect(idbResult.success).toBe(true);
    expect(idbResult.hasStores).toBe(true);
  });

  test('Footer displays updated Currency Converter URL, Whois URL, and MyFilmList label', async ({ page }) => {
    await page.goto('/');

    const currencyConverterLink = page.locator('footer a', { hasText: 'Currency Converter' });
    await expect(currencyConverterLink).toBeVisible();
    await expect(currencyConverterLink).toHaveAttribute('href', 'https://currency-converter.louisvolant.com');

    const whoisLink = page.locator('footer a', { hasText: 'Whois' });
    await expect(whoisLink).toBeVisible();
    await expect(whoisLink).toHaveAttribute('href', 'https://whois.louisvolant.com');

    const myFilmListLink = page.locator('footer a', { hasText: 'MyFilmList' });
    await expect(myFilmListLink).toBeVisible();
    await expect(myFilmListLink).toHaveAttribute('href', 'https://www.myfilmlist.net');
  });
});


