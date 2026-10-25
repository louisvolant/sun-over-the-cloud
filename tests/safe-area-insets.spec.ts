import { test, expect, Page } from '@playwright/test';

const STORAGE_KEY = 'sotc_safe_area_insets_v1';

async function mockApi(page: Page) {
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const send = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (pathname === '/api/check-auth') return send({ isAuthenticated: false });
    if (pathname === '/api/cached-favorites') return send([]);
    if (
      pathname === '/api/favorites' ||
      pathname === '/api/onecallmonthsummary' ||
      pathname === '/api/search'
    ) {
      return send([]);
    }
    return send({});
  });
}

test.describe('PWA safe-area insets', () => {
  test('keeps the last known Dynamic Island/home-indicator insets across client navigation', async ({
    page,
  }) => {
    // Emulate a standalone PWA session whose env() insets already resolved once
    // (59px top / 34px bottom on a Dynamic Island iPhone) and which is then
    // affected by the Next.js navigation bug that makes env() return 0.
    await page.addInitScript(
      ({ key }) => {
        window.localStorage.setItem(
          key,
          JSON.stringify({
            portrait: { top: 59, bottom: 34 },
            landscape: { top: 0, bottom: 21 },
          })
        );
        window.sessionStorage.setItem('is_pwa_mode', 'true');
      },
      { key: STORAGE_KEY }
    );

    await mockApi(page);
    await page.route('**/sw.js', (route) => route.abort());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const readVar = (name: string) =>
      page.evaluate(
        (varName) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim(),
        name
      );

    await expect.poll(() => readVar('--safe-top')).toBe('59px');
    await expect.poll(() => readVar('--safe-bottom')).toBe('34px');

    // The header must clear the Dynamic Island: 0.75rem (12px) + 59px.
    const headerPaddingTop = await page
      .locator('header')
      .evaluate((el) => window.getComputedStyle(el).paddingTop);
    expect(headerPaddingTop).toBe('71px');

    // The fixed footer nav must keep the home-indicator padding.
    const navPaddingBottom = await page
      .locator('nav[aria-label]')
      .evaluate((el) => window.getComputedStyle(el).paddingBottom);
    expect(navPaddingBottom).toBe('34px');

    // Navigate with Next.js <Link> (the operation that breaks env() on iOS)
    // and make sure the insets are re-applied on the new page.
    await page.locator('nav a[href="/search"]').click();
    await expect(page).toHaveURL(/\/search$/);
    await expect.poll(() => readVar('--safe-top')).toBe('59px');
    await expect.poll(() => readVar('--safe-bottom')).toBe('34px');
    expect(
      await page.locator('header').evaluate((el) => window.getComputedStyle(el).paddingTop)
    ).toBe('71px');

    await page.locator('nav a[href="/"]').click();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(() => readVar('--safe-top')).toBe('59px');
    expect(
      await page.locator('header').evaluate((el) => window.getComputedStyle(el).paddingTop)
    ).toBe('71px');
  });

  test('does not pin custom insets in a regular browser tab', async ({ page }) => {
    await mockApi(page);
    await page.route('**/sw.js', (route) => route.abort());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // No PWA session and no stored insets: CSS keeps the native env() values.
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.style.getPropertyValue('--safe-top'))
      )
      .toBe('');
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.style.getPropertyValue('--safe-bottom'))
      )
      .toBe('');
  });
});
