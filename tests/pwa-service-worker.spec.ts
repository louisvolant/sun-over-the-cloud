import { test, expect } from '@playwright/test';

test.describe('PWA service worker', () => {
  test('precaches only assets that exist so activation cannot fail', async ({ request }) => {
    const swResponse = await request.get('/sw.js');
    expect(swResponse.status()).toBe(200);
    const source = await swResponse.text();

    // cache.addAll() is atomic: a single missing URL used to abort the whole
    // install, leaving the PWA permanently unregistered.
    const declaration = source.match(/PRECACHE_ASSETS\s*=\s*\[([^\]]*)\]/);
    expect(declaration).not.toBeNull();

    const assets = Array.from(declaration![1].matchAll(/'([^']+)'/g), (match) => match[1]);
    expect(assets.length).toBeGreaterThan(0);

    for (const asset of assets) {
      const response = await request.get(asset);
      expect(response.status(), `${asset} must exist to be precached`).toBe(200);
    }
  });

  test('never resolves a static request with an undefined response', async ({ request }) => {
    const swResponse = await request.get('/sw.js');
    const source = await swResponse.text();

    // Firefox turns respondWith(undefined) into a hard "failed to load the
    // <script>" error, so the cache miss path must always return a Response.
    expect(source).toContain('return Response.error();');
    expect(source).not.toContain('fetch(req).catch(() => {})');
  });
});
