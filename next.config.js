const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: true,
  register: false,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
};

module.exports = withPWA(nextConfig);
