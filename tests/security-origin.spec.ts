import { test, expect } from '@playwright/test';
import { NextRequest } from 'next/server';
import { assertSameOrigin } from '@/lib/origin';

function makeRequest(options: {
  url?: string;
  origin?: string;
  referer?: string;
  host?: string;
  forwardedHost?: string;
} = {}) {
  const headers = new Headers();
  if (options.origin !== undefined) headers.set('origin', options.origin);
  if (options.referer !== undefined) headers.set('referer', options.referer);
  if (options.host !== undefined) headers.set('host', options.host);
  if (options.forwardedHost !== undefined) headers.set('x-forwarded-host', options.forwardedHost);
  return new NextRequest(options.url || 'https://sunoverthe.cloud/api/register', {
    method: 'POST',
    headers,
  });
}

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

test.afterEach(() => {
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }
});

test.describe('assertSameOrigin', () => {
  test('allows requests without Origin or Referer', () => {
    expect(assertSameOrigin(makeRequest({ host: 'sunoverthe.cloud' }))).toBeNull();
  });

  test('allows the configured public site origin from a preview host', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://sunoverthe.cloud';
    expect(
      assertSameOrigin(
        makeRequest({
          url: 'https://preview-123.workers.dev/api/register',
          host: 'preview-123.workers.dev',
          origin: 'https://sunoverthe.cloud',
        })
      )
    ).toBeNull();
  });

  test('allows the current request host', () => {
    expect(
      assertSameOrigin(
        makeRequest({
          url: 'https://preview-123.workers.dev/api/register',
          host: 'preview-123.workers.dev',
          origin: 'https://preview-123.workers.dev',
        })
      )
    ).toBeNull();
  });

  test('allows the first X-Forwarded-Host hop', () => {
    expect(
      assertSameOrigin(
        makeRequest({
          url: 'http://internal/api/register',
          host: 'internal',
          forwardedHost: 'preview-123.workers.dev, proxy.internal',
          origin: 'https://preview-123.workers.dev',
        })
      )
    ).toBeNull();
  });

  test('allows apex and www variants of the same domain', () => {
    expect(
      assertSameOrigin(
        makeRequest({
          url: 'https://sunoverthe.cloud/api/register',
          host: 'sunoverthe.cloud',
          origin: 'https://www.sunoverthe.cloud',
        })
      )
    ).toBeNull();

    expect(
      assertSameOrigin(
        makeRequest({
          url: 'https://www.sunoverthe.cloud/api/register',
          host: 'www.sunoverthe.cloud',
          origin: 'https://sunoverthe.cloud',
        })
      )
    ).toBeNull();
  });

  test('allows local development hosts', () => {
    for (const host of ['localhost:3000', '127.0.0.1:3000', '[::1]:3000', 'my-mac.local:3000']) {
      expect(
        assertSameOrigin(
          makeRequest({
            url: `http://${host}/api/register`,
            host,
            origin: `http://${host}`,
          })
        )
      ).toBeNull();
    }
  });

  test('rejects a cross-site origin with the expected JSON error', async () => {
    const response = assertSameOrigin(
      makeRequest({
        url: 'https://sunoverthe.cloud/api/register',
        host: 'sunoverthe.cloud',
        origin: 'https://evil.example',
      })
    );
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({ error: 'invalid_origin' });
  });

  test('rejects malformed and null origins', () => {
    expect(
      assertSameOrigin(
        makeRequest({ host: 'sunoverthe.cloud', origin: 'not a valid url' })
      )?.status
    ).toBe(403);
    expect(
      assertSameOrigin(makeRequest({ host: 'sunoverthe.cloud', origin: 'null' }))?.status
    ).toBe(403);
    expect(
      assertSameOrigin(makeRequest({ host: 'sunoverthe.cloud', origin: '' }))?.status
    ).toBe(403);
  });

  test('falls back to Referer when Origin is absent', () => {
    expect(
      assertSameOrigin(
        makeRequest({
          url: 'https://sunoverthe.cloud/api/register',
          host: 'sunoverthe.cloud',
          referer: 'https://sunoverthe.cloud/register',
        })
      )
    ).toBeNull();

    expect(
      assertSameOrigin(
        makeRequest({
          url: 'https://sunoverthe.cloud/api/register',
          host: 'sunoverthe.cloud',
          referer: 'https://evil.example/register',
        })
      )?.status
    ).toBe(403);
  });
});
