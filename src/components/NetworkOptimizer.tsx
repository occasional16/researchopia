'use client';

import { useEffect } from 'react';

export default function NetworkOptimizer() {
  useEffect(() => {
    // DNS预解析优化
    const preconnectLinks = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      'https://www.researchopia.com',
    ];

    preconnectLinks.forEach(href => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = href;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });

    // Service Worker注册（用于缓存优化）
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.log('Service Worker registration failed:', err);
      });
    }

    // 预加载关键资源
    const criticalResources = ['/api/site/statistics', '/api/papers/recent-comments'];
    criticalResources.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      document.head.appendChild(link);
    });

  }, []);

  return null; // 这是一个纯优化组件，不渲染任何内容
}