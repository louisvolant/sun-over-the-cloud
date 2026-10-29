import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      // Main e2e server: the explicit test flag lets journeys that use
      // @example.com pass the registration email policy.
      command: 'npm run start',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: { ...process.env, E2E: '1' } as Record<string, string>,
    },
    {
      // Strict server without the e2e bypass, used by the security tests that
      // must exercise the real production-mode email policy.
      command: 'npm run start -- -p 3001',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: { ...process.env, E2E: '0' } as Record<string, string>,
    },
  ],
});
