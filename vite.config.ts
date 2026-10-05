import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { productUrlDevPlugin } from './vite.product-url-plugin.ts'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    productUrlDevPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Patchwork',
        short_name: 'Patchwork',
        description:
          'Track skincare products and eliminate ingredients that cause breakouts.',
        theme_color: '#1f3d2b',
        background_color: '#f3efe6',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/world\.openbeautyfacts\.org\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'open-beauty-facts',
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
})
