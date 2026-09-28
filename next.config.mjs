// next.config.mjs
import { createRequire } from 'module';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const require = createRequire(import.meta.url);

// Makes the Cloudflare bindings (D1 `DB`, KV `CACHE`) available to the local
// `next dev` server through wrangler's platform proxy. No-op outside dev.
if (process.env.NODE_ENV === 'development') {
  initOpenNextCloudflareForDev();
}

const withPWA = require('next-pwa')({
  dest: 'public',
  // Activation of automatic skipWaiting
  skipWaiting: true,
  // Disable in dev mode to not interfere with fast reloads
  disable: process.env.NODE_ENV === 'development',
  register: true,
  // Addition of runTimeCaching (good practice for the PWA)
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.(js|css|woff2?|png|jpg|webp|svg)/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-resources',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/((?!_next/static|_next/image|favicon\\.ico|icon\\.(?:png|svg)|manifest\\.json|robots\\.txt).*)',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
      {
        source: '/_next/static/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'openweathermap.org',
        pathname: '/img/wn/**',
      },
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.stats = 'errors-warnings'; // Only show errors and warnings
    }
    return config;
  },
};

export default nextConfig;
// PWA wrapper currently disabled (kept for reference): export default withPWA(nextConfig);
