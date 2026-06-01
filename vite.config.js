import { defineConfig } from 'vite';

const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  root: '.',
  publicDir: 'public',
  optimizeDeps: {
    include: ['html2pdf.js'],
  },
  build: {
    outDir: 'dist',
    commonjsOptions: {
      include: [/html2pdf.js/, /node_modules/],
    },
  },
});
