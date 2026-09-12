// next.config.js
/** @type {import('next').NextConfig} */

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

const nextConfig = {
  output: 'standalone',
  env: {
    BACKEND_URL: process.env.BACKEND_URL,
  },
  reactStrictMode: true,
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

// Export the unique result of applying the PWA wrapper to the configuration
module.exports = nextConfig;
///module.exports = withPWA(nextConfig);