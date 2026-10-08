import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
const base = process.env.VITE_BASE_PATH || '/';
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwind(),
    VitePWA({
      registerType: 'prompt',
      scope: base,
      manifest: {
        name: 'FloraBot — Tủ hoa',
        short_name: 'FloraBot',
        lang: 'vi',
        display: 'fullscreen',
        start_url: base,
        scope: base,
        theme_color: '#204b2e',
        background_color: '#ffffff',
        icons: [{ src: `${base}icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,avif,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:5080',
        changeOrigin: false,
      },
    },
  },
});
