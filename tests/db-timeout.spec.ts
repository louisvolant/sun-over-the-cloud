import { test, expect } from '@playwright/test';
import { withTimeout, withDbTimeout, DB_OPERATION_TIMEOUT_MS } from '@/lib/timeout';
import { withDbRetry } from '@/lib/mongoose';

/**
 * Unit coverage for the MongoDB timeout/retry helpers used by the favorites
 * API. They exist because the Workers runtime cancels a request whose async
 * work never settles (Cloudflare error 1101), so every database call must be
 * bounded and transient failures retried.
 */
test.describe('Database timeout helpers', () => {
  test('withTimeout resolves fast promises and rejects past the deadline', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
    await expect(withTimeout(new Promise(() => {}), 50)).rejects.toThrow(/timed out/i);
  });

  test('withDbTimeout uses a positive database budget', () => {
    expect(DB_OPERATION_TIMEOUT_MS).toBeGreaterThan(0);
  });

  test('withDbTimeout bounds a hanging operation', async () => {
    await expect(withDbTimeout(new Promise(() => {}))).rejects.toThrow(/timed out/i);
  });

  test('withDbRetry retries transient failures and eventually succeeds', async () => {
    let attempts = 0;
    const result = await withDbRetry(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('transient failure');
      return 'ok';
    }, 3);

    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  test('withDbRetry gives up after the configured attempts', async () => {
    let attempts = 0;
    await expect(
      withDbRetry(async () => {
        attempts += 1;
        throw new Error('always failing');
      }, 2),
    ).rejects.toThrow('always failing');
    expect(attempts).toBe(2);
  });

  test('withDbRetry does not retry configuration errors', async () => {
    let attempts = 0;
    await expect(
      withDbRetry(async () => {
        attempts += 1;
        throw new Error('MongoDB Atlas environment variables are not configured');
      }, 3),
    ).rejects.toThrow(/not configured/);
    expect(attempts).toBe(1);
  });
});
