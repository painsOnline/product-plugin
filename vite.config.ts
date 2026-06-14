import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  server: {
    port: 5199,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: mode === 'production' ? 'dist/build' : 'dist/dev',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        background: resolve(__dirname, 'src/services/background.ts'),
        'content-1688': resolve(__dirname, 'src/content/1688.ts'),
        'content-taobao': resolve(__dirname, 'src/content/taobao.ts'),
        'content-jieshun': resolve(__dirname, 'src/content/jieshun.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
}));
