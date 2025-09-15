import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  // 修复工作区根目录警告
  outputFileTracingRoot: path.join(__dirname),
  
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
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        // Production origins
        'https://academic-rating.vercel.app',
        'https://www.researchopia.com'
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
          // 启用更好的缓存策略
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
          },
          // 注意：不要强制声明 Content-Encoding，交由框架自动处理压缩
          // 如果手动设置 gzip 而未实际压缩，会导致浏览器解码失败（TypeError: Failed to fetch）
        ],
      },
      // 静态资源长期缓存
      {
        source: '/(.*)\\.(ico|png|jpg|jpeg|gif|webp|svg|css|js)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
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
