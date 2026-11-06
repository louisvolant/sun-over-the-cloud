import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('OpenNext Cloudflare Worker Bundle Verification', () => {
  const root = process.cwd();
  const workerFile = path.resolve(root, '.open-next', 'worker.js');
  const assetsDir = path.resolve(root, '.open-next', 'assets');
  const wranglerFile = path.resolve(root, 'wrangler.toml');

  test('wrangler.toml specifies correct worker entrypoint and assets directory', () => {
    expect(fs.existsSync(wranglerFile)).toBe(true);
    const wranglerContent = fs.readFileSync(wranglerFile, 'utf8');

    expect(wranglerContent).toContain('main = ".open-next/worker.js"');
    expect(wranglerContent).toContain('directory = ".open-next/assets"');
    expect(wranglerContent).toContain('nodejs_compat');
  });

  test('.open-next/worker.js entrypoint exists and defines cloudflare fetch handler', () => {
    expect(fs.existsSync(workerFile)).toBe(true);
    const content = fs.readFileSync(workerFile, 'utf8');
    expect(content).toContain('async fetch(request, env, ctx)');
    expect(content).toContain('runWithCloudflareRequestContext');

    // Also assert the compiled server handler is populated
    const serverHandlerFile = path.resolve(root, '.open-next', 'server-functions', 'default', 'handler.mjs');
    expect(fs.existsSync(serverHandlerFile)).toBe(true);
    const handlerStats = fs.statSync(serverHandlerFile);
    expect(handlerStats.size).toBeGreaterThan(1_000_000);
  });

  test('.open-next/assets exists and includes static client assets', () => {
    expect(fs.existsSync(assetsDir)).toBe(true);
    const assetsStat = fs.statSync(assetsDir);
    expect(assetsStat.isDirectory()).toBe(true);

    const nextStaticDir = path.resolve(assetsDir, '_next', 'static');
    expect(fs.existsSync(nextStaticDir)).toBe(true);
  });
});
