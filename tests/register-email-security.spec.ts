import { test, expect } from '@playwright/test';
import {
  VALID_PASSWORD,
  databaseAvailable,
  uniqueSuffix,
  username,
  withStrictServer,
} from './helpers/security';

test.describe('Registration email security', () => {
  test('rejects disallowed email domains with a generic message', async ({ playwright }) => {
    await withStrictServer(playwright, async (request) => {
      const email = `sec_${uniqueSuffix()}@example.com`;
      const response = await request.post('/api/register', {
        data: {
          username: username(),
          email,
          password: VALID_PASSWORD,
        },
      });

      expect(response.status()).toBe(400);
      expect((await response.json()).error).toBe('Please use a real email address.');

      if (await databaseAvailable(request)) {
        const login = await request.post('/api/login', {
          data: { username: email, password: VALID_PASSWORD },
        });
        expect(login.status()).toBe(401);
      }
    });
  });

  test('accepts a real domain and rejects a duplicate when the database is available', async ({
    playwright,
  }) => {
    await withStrictServer(playwright, async (request) => {
      const dbAvailable = await databaseAvailable(request);
      test.skip(!dbAvailable, 'D1 bindings are unavailable in this environment.');

      const email = `sec_${uniqueSuffix()}@sunoverthe.cloud`;
      const first = await request.post('/api/register', {
        data: { username: username(), email, password: VALID_PASSWORD },
      });
      expect(first.status()).toBe(200);
      expect(await first.json()).toEqual({ success: true });

      const duplicate = await request.post('/api/register', {
        data: { username: username(), email, password: VALID_PASSWORD },
      });
      expect(duplicate.status()).toBe(409);
    });
  });

  test('accepts @example.com when the e2e bypass is enabled', async ({ request }) => {
    // The main server (port 3000) is started with E2E=1 by playwright.config.ts.
    const response = await request.post('/api/register', {
      data: {
        username: username(),
        email: `sec_${uniqueSuffix()}@example.com`,
        password: VALID_PASSWORD,
      },
    });
    // The bypass only skips the domain policy; the database must still accept
    // the account (or be unavailable in this environment). A policy rejection
    // would return 400, which this assertion would catch.
    expect([200, 500]).toContain(response.status());
  });
});
