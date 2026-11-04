import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Next.js Config Cache-Control Rules', () => {
  test('defines optimized Edge CDN cache headers without overriding API routes', () => {
    const configPath = path.resolve(process.cwd(), 'next.config.mjs');
    const source = fs.readFileSync(configPath, 'utf8');

    // 1. Static chunks rule
    expect(source).toContain("source: '/_next/static/(.*)'");
    expect(source).toContain("public, max-age=31536000, immutable");

    // 2. Metadata assets rule (sitemap, robots, manifest, icons)
    expect(source).toContain("sitemap\\\\.xml|robots\\\\.txt|manifest\\\\.json");
    expect(source).toContain("s-maxage=86400");

    // 3. Page documents rule (excludes api/ and sw.js, enables Edge caching with s-maxage)
    expect(source).toContain("api/|sitemap\\\\.xml");
    expect(source).toContain("max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  });
});
