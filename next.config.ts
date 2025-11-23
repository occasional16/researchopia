import type { NextConfig } from "next";
import path from 'path';
import createMDX from '@next/mdx';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

const nextConfig: NextConfig = {
  // 支持 MDX 页面
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
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
    // 启用图片优化
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30天
    // 设备尺寸断点
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // 图片尺寸断点
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
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
        'https://www.researchopia.com'
      ]
    },

    optimizePackageImports: ['lucide-react'],
    
    // 🔥 优化: 完全关闭 Speed Insights 以减少数据点消耗
    // webVitalsAttribution: ['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB'], // 已禁用
  },
  
  // 🔥 优化: 关闭 Analytics (如果不需要详细分析)
  // analyticId: undefined, // 取消注释以完全禁用

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
            value: 'public, max-age=600, s-maxage=1200, stale-while-revalidate=1800',
          },
          // 注意：不要强制声明 Content-Encoding，交由框架自动处理压缩
          // 如果手动设置 gzip 而未实际压缩，会导致浏览器解码失败（TypeError: Failed to fetch）
        ],
      },
      // 静态资源长期缓存
      {
        source: '/(.*)\\.(ico|png|jpg|jpeg|gif|webp|svg|css|js|woff|woff2|ttf|eot)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // HTML页面使用短期缓存
      {
        source: '/((?!api|_next/static|_next/image).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },

  // Webpack配置
  webpack: (config, { isServer }) => {
    // PDF.js worker支持
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'pdfjs-dist/build/pdf.worker.entry': 'pdfjs-dist/build/pdf.worker.min.js',
      };
    }
    
    // 排除Debug目录，避免扫描备份代码
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: /\.tsx?$/,
      exclude: /Debug[\\/]/,
    });
    
    return config;
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

// MDX 配置
const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeHighlight,
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: 'wrap' }],
    ],
  },
});

export default withMDX(nextConfig);
