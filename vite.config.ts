import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

// PWA instalable con modo sin conexión (RF-22, RNF-06).
export default defineConfig({
  root: 'web',
  resolve: { alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) } },
  publicDir: 'public',
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'AlgoCity: algoritmos como ciudad navegable',
        short_name: 'AlgoCity',
        description: 'Aprende algoritmos recorriendo una ciudad con tu voz.',
        lang: 'es-PE',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f3f5f1',
        theme_color: '#0b6e4f',
        categories: ['education'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/],
        runtimeCaching: [
          { urlPattern: ({ url }) => url.pathname === '/api/salas', handler: 'NetworkFirst', options: { cacheName: 'salas', networkTimeoutSeconds: 3 } },
        ],
      },
    }),
  ],
});
