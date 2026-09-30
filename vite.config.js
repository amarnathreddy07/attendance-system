import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/attendance-system/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'AttendIt — Teacher Attendance',
        short_name: 'AttendIt',
        description: 'Local-first attendance management for teachers. All data stays on your device.',
        theme_color: '#4f46e5',
        background_color: '#4f46e5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/attendance-system/',
        scope: '/attendance-system/',
        icons: [
          { src: './icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: './icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: './maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        navigateFallback: '/attendance-system/index.html',
      },
    }),
  ],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
}));
