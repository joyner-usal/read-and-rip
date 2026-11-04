import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves a project site from /<repo-name>/. The deploy workflow
// sets BASE_PATH; local dev falls back to the root.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Read and Rip',
        short_name: 'Read and Rip',
        description: 'Read the cue. Pick the spot. A USA Lacrosse game.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        // Manifest colors cannot read CSS variables. Keep these two in step
        // with --rr-navy and --rr-off-white in brand/tokens.css.
        theme_color: '#001F58',
        background_color: '#FAF7F6',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        navigateFallback: 'index.html'
      }
    })
  ]
});
