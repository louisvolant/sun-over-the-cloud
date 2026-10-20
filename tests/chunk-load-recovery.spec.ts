import { test, expect } from '@playwright/test';

test.describe('Chunk load recovery', () => {
  test('reloads the page once when a Next.js chunk fails to load', async ({ page }) => {
    let failedOnce = false;

    // Abort exactly one page chunk on the first document load. The inline
    // guard must detect the failed script and reload the page with a fresh
    // HTML document; the second load is allowed to fetch every chunk.
    await page.route('**/_next/static/chunks/app/page-*.js', (route) => {
      if (!failedOnce) {
        failedOnce = true;
        return route.abort('failed');
      }
      return route.continue();
    });

    let documentNavigations = 0;
    page.on('request', (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        documentNavigations += 1;
      }
    });

    // The failed chunk triggers a replacement navigation, which can interrupt
    // the initial goto() promise.
    await page.goto('/').catch(() => undefined);

    await expect(page.locator('input[type="text"]').first()).toBeVisible({ timeout: 20000 });

    expect(failedOnce).toBe(true);
    expect(documentNavigations).toBeGreaterThanOrEqual(2);

    // The retry marker is stripped once the app loads successfully, so it does
    // not linger in the URL or in shared links.
    await expect(page).not.toHaveURL(/chunk_retry=1/);
  });
});
