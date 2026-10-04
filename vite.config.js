import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// onnxruntime-web's bundled entry makes Vite emit a second copy of the WASM
// into /assets. We self-host the runtime under /ort/ (ort.env.wasm.wasmPaths),
// so drop the duplicate to keep the deploy and the precache small.
const dropDuplicateOrtWasm = {
  name: 'drop-duplicate-ort-wasm',
  apply: 'build',
  generateBundle(_opts, bundle) {
    for (const key of Object.keys(bundle)) {
      if (/ort-wasm.*.wasm$/.test(key)) delete bundle[key]
    }
  },
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// https://vite.dev/config/
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    dropDuplicateOrtWasm,
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      strategies: 'generateSW',
      manifest: {
        name: 'Chakra',
        short_name: 'Chakra',
        description: 'Revisa hojas de café, riesgo de roya y broca, y precio justo. Funciona sin internet.',
        lang: 'es-PE',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f3ebdb',
        theme_color: '#2e6b3a',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,svg,png,woff2}',
          'ort/*.{wasm,mjs}',
          'model/*.{onnx,json}',
          'data/**/*.json',
        ],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
