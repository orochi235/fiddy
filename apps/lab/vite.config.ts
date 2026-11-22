import { alpo } from '@msb235/alpo/vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  base: './',
  plugins: [alpo(), react()],
  resolve: {
    alias: {
      fiddy: at('../../packages/fiddy/src/index.ts'),
      '@lab': at('./src'),
    },
    // Linked from a weasel checkout, its own React would otherwise load twice.
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '::',
    port: 5199,
    strictPort: true,
    fs: { allow: [searchForWorkspaceRoot(process.cwd())] },
  },
  preview: { host: '::', port: 5199 },
});
