import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { SECURITY_HEADERS } from './config/security-headers.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: false },
  preview: { port: 4173, headers: SECURITY_HEADERS },
  build: {
    target: 'es2022',
    sourcemap: true,
    // Monaco's core chunk (~2.6 MB raw, ~700 KB gzip) exceeds the default limit; it is lazy-loaded
    // only when an editor is first shown.
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('echarts') || id.includes('zrender')) return 'vendor-echarts';
          if (id.includes('@mui') || id.includes('@emotion')) return 'vendor-mui';
          if (id.includes('dexie')) return 'vendor-dexie';
          if (id.includes('iconsax')) return 'vendor-icons';
          if (/[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
  worker: { format: 'es' },
});
