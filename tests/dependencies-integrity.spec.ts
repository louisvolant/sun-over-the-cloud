import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Package Dependencies and Security Overrides Integrity', () => {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  test('ensures no duplicate packages between dependencies and devDependencies', () => {
    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});

    const duplicates = deps.filter((dep) => devDeps.includes(dep));
    expect(duplicates).toEqual([]);
  });

  test('ensures security overrides exist for transitive pwa packages', () => {
    expect(pkg.overrides).toBeDefined();
    expect(pkg.overrides['serialize-javascript']).toBeDefined();
    expect(pkg.overrides['deepmerge']).toBeDefined();
  });

  test('ensures package-lock.json resolves overridden security versions', () => {
    const lockPath = path.resolve(process.cwd(), 'package-lock.json');
    if (!fs.existsSync(lockPath)) return;

    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const packages = lock.packages || {};

    // Check serialize-javascript instances
    for (const [pkgKey, pkgData] of Object.entries(packages)) {
      if (pkgKey.endsWith('node_modules/serialize-javascript')) {
        const version = (pkgData as { version?: string }).version || '';
        const major = parseInt(version.split('.')[0], 10);
        const minor = parseInt(version.split('.')[1], 10);
        const patch = parseInt(version.split('.')[2], 10);
        expect(major >= 7 && (minor > 1 || (minor === 1 && patch >= 3))).toBe(true);
      }
    }
  });

  test('ensures core frameworks and Cloudflare tools are at least secure patched versions', () => {
    const semverGte = (version: string, targetMajor: number, targetMinor: number, targetPatch: number) => {
      const clean = version.replace(/^[^\d]*/, '');
      const [maj, min, pat] = clean.split('.').map((n) => parseInt(n, 10));
      if (maj > targetMajor) return true;
      if (maj === targetMajor && min > targetMinor) return true;
      return maj === targetMajor && min === targetMinor && pat >= targetPatch;
    };

    expect(semverGte(pkg.dependencies.next, 16, 4, 5)).toBe(true);
    expect(semverGte(pkg.dependencies.react, 19, 3, 1)).toBe(true);
    expect(semverGte(pkg.dependencies.tailwindcss, 4, 3, 5)).toBe(true);
    expect(semverGte(pkg.devDependencies['@opennextjs/cloudflare'], 1, 20, 16)).toBe(true);
    expect(semverGte(pkg.devDependencies.wrangler, 4, 158, 0)).toBe(true);
    expect(semverGte(pkg.devDependencies['@playwright/test'], 1, 65, 0)).toBe(true);
  });
});
