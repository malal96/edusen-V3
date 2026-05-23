import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      // 'prompt' = on garde le contrôle d'afficher la bannière à l'utilisateur
      // (registerType est OK, mais on ajoute skipWaiting/clientsClaim dans workbox)
      registerType: 'prompt',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'EduSen — Gestion scolaire',
        short_name: 'EduSen',
        description: 'Application de gestion scolaire pour le Sénégal',
        theme_color: '#1a4731',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'fr',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // CRITIQUE pour la mise à jour : force le nouveau SW à prendre le contrôle immédiatement
        // dès qu'on lui envoie SKIP_WAITING, sans attendre que tous les onglets soient fermés.
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            // Cache des polices Google
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets'
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            // Firestore : Network First (essayer le réseau en premier, fallback cache)
            urlPattern: /^https:\/\/firestore\.googleapis\.com/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-data',
              networkTimeoutSeconds: 5
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
});
