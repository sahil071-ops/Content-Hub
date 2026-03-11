/** @type {import('next').NextConfig} */
const nextConfig = {
  // Unique build ID per deployment — invalidates old service workers
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: '**.backblazeb2.com',
      },
      // Allow any hostname for OG images from archived blogs
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Proper cache headers — HTML never cached, static assets long-cached
  async headers() {
    return [
      {
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Allow server-side fetch to external URLs for blog archiving (Next.js 14)
  experimental: {
    serverComponentsExternalPackages: ['node-html-parser'],
  },
};

module.exports = nextConfig;
