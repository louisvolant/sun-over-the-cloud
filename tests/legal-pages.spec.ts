import { test, expect } from '@playwright/test';

test.describe('Legal Pages (/privacy and /terms)', () => {
  test('Privacy Policy page loads and displays all sections', async ({ page }) => {
    const response = await page.goto('/privacy');
    expect(response?.status()).toBe(200);

    const title = page.locator('article h1');
    await expect(title).toBeVisible();
    await expect(title).toContainText(/privacy policy/i);

    // Verify presence of all 5 main sections
    await expect(page.locator('text=1. Information We Collect')).toBeVisible();
    await expect(page.locator('text=2. Cookies & Local Storage')).toBeVisible();
    await expect(page.locator('text=3. Third-Party Meteorological Services')).toBeVisible();
    await expect(page.locator('text=4. Your Rights & Data Deletion (GDPR)')).toBeVisible();
    await expect(page.locator('text=5. Contact & Questions')).toBeVisible();

    // Verify back-to-home link
    const backLink = page.locator('a', { hasText: /back to home/i });
    await expect(backLink).toBeVisible();
    await backLink.click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('Terms of Service page loads and displays all sections', async ({ page }) => {
    const response = await page.goto('/terms');
    expect(response?.status()).toBe(200);

    const title = page.locator('article h1');
    await expect(title).toBeVisible();
    await expect(title).toContainText(/terms of service/i);

    // Verify presence of all 4 main sections
    await expect(page.locator('text=1. Acceptable Use')).toBeVisible();
    await expect(page.locator('text=2. Weather Data Disclaimer')).toBeVisible();
    await expect(page.locator('text=3. User Accounts & Security')).toBeVisible();
    await expect(page.locator('text=4. Limitation of Liability')).toBeVisible();

    // Verify back-to-home link
    const backLink = page.locator('a', { hasText: /back to home/i });
    await expect(backLink).toBeVisible();
    await backLink.click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('Footer displays Privacy and Terms links and navigates correctly', async ({ page }) => {
    await page.goto('/');

    const privacyLink = page.locator('footer a', { hasText: /privacy policy/i });
    await expect(privacyLink).toBeVisible();
    await expect(privacyLink).toHaveAttribute('href', '/privacy');

    const termsLink = page.locator('footer a', { hasText: /terms of service/i });
    await expect(termsLink).toBeVisible();
    await expect(termsLink).toHaveAttribute('href', '/terms');

    // Click Privacy Policy from footer
    await privacyLink.click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.locator('article h1')).toContainText(/privacy policy/i);

    // Click Terms of Service from footer on the Privacy page
    const footerTermsLink = page.locator('footer a', { hasText: /terms of service/i });
    await footerTermsLink.click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.locator('article h1')).toContainText(/terms of service/i);
  });

  test('Legal pages translate correctly when language is changed', async ({ page }) => {
    await page.goto('/privacy');

    // Default English
    await expect(page.locator('article h1')).toContainText('Privacy Policy');

    // Switch language using bottom language selector
    const langSelect = page.locator('select').first();
    await langSelect.selectOption('fr');

    // Should reactively translate to French
    await expect(page.locator('article h1')).toContainText('Politique de confidentialité');
    await expect(page.locator('text=1. Informations collectées')).toBeVisible();
    await expect(page.locator('footer a', { hasText: 'Conditions d\'utilisation' })).toBeVisible();

    // Switch to Spanish
    await langSelect.selectOption('es');
    await expect(page.locator('article h1')).toContainText('Política de privacidad');
    await expect(page.locator('text=1. Información que recopilamos')).toBeVisible();
    await expect(page.locator('footer a', { hasText: 'Términos del servicio' })).toBeVisible();
  });
});
