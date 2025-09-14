import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  // 性能优化配置
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // 压缩配置
  compress: true,

  // 实验性功能
  experimental: {
    serverActions: {
      // Use fully-qualified origins to avoid URL parsing errors in production
      allowedOrigins: [
        // Development origins
        'http://localhost:3006',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        // Production origin (keep minimal to avoid parsing variance)
        'https://researchopia.vercel.app'
      ]
    },

    optimizePackageImports: ['lucide-react']
  },

  // 头部配置
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // 开发环境允许iframe嵌入，生产环境可以启用更严格的安全策略
          // {
          //   key: 'X-Frame-Options',
          //   value: 'SAMEORIGIN',
          // },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, s-maxage=60',
          },
        ],
      },
    ];
  },

  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    }
  }
};

export default nextConfig;
