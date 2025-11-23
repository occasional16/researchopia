import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/Debug/**',
      '**/.next/**',
      '**/zotero-plugin/**',
      '**/extension/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/app/**', // Next.js app router页面,难以测试
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'tests/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@researchopia/shared': path.resolve(__dirname, './packages/shared/src'),
    },
  },
  esbuild: {
    jsx: 'automatic', // 启用 JSX 自动转换
  },
});
