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
});
