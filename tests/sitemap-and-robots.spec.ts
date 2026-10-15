import { test, expect } from '@playwright/test';

test.describe('SEO: Sitemap and Robots.txt', () => {
  test('GET /sitemap.xml returns complete and valid XML including all public pages', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toMatch(/(xml|text)/i);

    const body = await response.text();

    // Verify all public indexable pages are declared in the sitemap
    expect(body).toContain('<loc>https://sunoverthe.cloud</loc>');
    expect(body).toContain('<loc>https://sunoverthe.cloud/search</loc>');
    expect(body).toContain('<loc>https://sunoverthe.cloud/register</loc>');
    expect(body).toContain('<loc>https://sunoverthe.cloud/privacy</loc>');
    expect(body).toContain('<loc>https://sunoverthe.cloud/terms</loc>');

    // Verify private authenticated account portal is excluded from public sitemap
    expect(body).not.toContain('<loc>https://sunoverthe.cloud/account</loc>');
  });

  test('GET /robots.txt disallows private routes and points to sitemap.xml', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Allow: /');
    expect(body).toContain('Disallow: /account');
    expect(body).toContain('Disallow: /api/');
    expect(body).toContain('Sitemap: https://sunoverthe.cloud/sitemap.xml');
  });

  test('All URLs declared in sitemap are reachable with HTTP 200', async ({ page }) => {
    const urls = ['/', '/search', '/register', '/privacy', '/terms'];

    for (const path of urls) {
      const response = await page.goto(path);
      expect(response?.status(), `Expected ${path} to return 200`).toBe(200);
    }
  });
});
