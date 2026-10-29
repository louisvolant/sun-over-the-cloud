import { test, expect } from '@playwright/test';
import {
  VALID_PASSWORD,
  databaseAvailable,
  uniqueSuffix,
  username,
  withStrictServer,
} from './helpers/security';

test.describe('Registration origin security', () => {
  test('rejects a cross-site Origin before touching the database', async ({ playwright }) => {
    await withStrictServer(playwright, async (request) => {
      const email = `sec_${uniqueSuffix()}@sunoverthe.cloud`;
      const response = await request.post('/api/register', {
        headers: { Origin: 'https://evil.example' },
        data: {
          username: username(),
          email,
          password: VALID_PASSWORD,
        },
      });

      expect(response.status()).toBe(403);
      expect(await response.json()).toEqual({ error: 'invalid_origin' });

      if (await databaseAvailable(request)) {
        const login = await request.post('/api/login', {
          data: { username: email, password: VALID_PASSWORD },
        });
        expect(login.status()).toBe(401);
      }
    });
  });
});
