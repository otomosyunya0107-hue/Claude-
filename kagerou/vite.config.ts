import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base: './' で任意のサブパスや Capacitor の WebView から読み込めるようにする
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    // 1 ファイル版（--mode single）は動的 import も本体に含める
    rollupOptions: mode === 'single' ? { output: { codeSplitting: false } } : {},
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
