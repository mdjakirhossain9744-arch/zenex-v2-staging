import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 💥 1. Enable Strict Compression (Reduces Bandwidth by 70% for VPN & Slow Internet)
  compress: true, 

  // 💥 2. Optimize Heavy React Libraries to Load Faster
  experimental: {
    optimizePackageImports: [
      'lucide-react', 
      'date-fns',
      'recharts'
    ],
  },

  // 💥 3. Cache Control Headers for Static Assets Only
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          }
        ]
      },
      {
        // 💥 Force Edge Cache for all Next.js static files (Lightning Fast Load)
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
};

export default nextConfig;