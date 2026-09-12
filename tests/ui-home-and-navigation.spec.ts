import { test, expect } from '@playwright/test';

test.describe('UI Navigation and Interactions', () => {
  test('Home page renders correctly with search bar and branding', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Sun Over The Cloud/i);

    const searchInput = page.locator('input[type="text"]');
    await expect(searchInput).toBeVisible();

    const searchButton = page.locator('button', { hasText: /search/i });
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

    const searchButton = page.locator('button', { hasText: /search/i });
    await searchButton.click();

    // Wait for the geocoding dropdown result to appear
    const resultItem = page.locator('div.cursor-pointer', { hasText: /Nice/i }).first();
    await expect(resultItem).toBeVisible({ timeout: 20000 });

    // Click on the result to fetch live weather from MET Norway
    await resultItem.click();

    // The weather display card should appear with temperature in °C
    const weatherCard = page.locator('text=°C').first();
    await expect(weatherCard).toBeVisible({ timeout: 20000 });
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
});
