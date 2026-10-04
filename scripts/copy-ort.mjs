// Self-host the onnxruntime-web WASM runtime so inference works offline
// (no CDN). Copies the SIMD+threaded build used by the 'onnxruntime-web/wasm' entry.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'onnxruntime-web', 'dist')
const dest = join(root, 'public', 'ort')
const FILES = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']

if (!existsSync(src)) {
  console.warn('[copy-ort] onnxruntime-web not installed yet; skipping')
  process.exit(0)
}
mkdirSync(dest, { recursive: true })
for (const f of FILES) {
  copyFileSync(join(src, f), join(dest, f))
}
console.log(`[copy-ort] copied ${FILES.join(', ')} -> public/ort/`)
