import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Porta fixa e própria deste projeto — o CRM Hinode (projeto irmão) roda na 5173.
  server: { port: 5175, strictPort: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'push-sw.js', 'favicon.svg'],
      manifest: {
        name: 'Visita IA — CRM',
        short_name: 'Visita IA',
        description: 'CRM para incorporadoras e imobiliárias de alto padrão.',
        theme_color: '#0A0F1A',
        background_color: '#F2F5FA',
        display: 'standalone',
        start_url: '/login',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        importScripts: ['/push-sw.js'],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
})
