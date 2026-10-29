import type { APIRequestContext } from '@playwright/test';

export const VALID_PASSWORD = 'ValidPassword12345';
// The second Playwright web server runs without E2E=1 so the real production
// email policy can be exercised (the main server keeps the e2e bypass).
export const STRICT_BASE_URL = 'http://localhost:3001';

export function uniqueSuffix() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function username() {
  return `sec_user_${uniqueSuffix()}`;
}

export async function databaseAvailable(request: APIRequestContext) {
  // `next start` has no Cloudflare D1 binding; probe with a login that would
  // return 401 on a reachable database and 500 when bindings are missing.
  const probe = await request.post('/api/login', {
    data: { username: `missing_${uniqueSuffix()}`, password: 'wrong_password_test_123' },
  });
  return probe.status() === 401;
}

export async function withStrictServer(
  playwright: import('@playwright/test').PlaywrightWorkerArgs['playwright'],
  run: (request: APIRequestContext) => Promise<void>
) {
  const strict = await playwright.request.newContext({ baseURL: STRICT_BASE_URL });
  try {
    await run(strict);
  } finally {
    await strict.dispose();
  }
}
