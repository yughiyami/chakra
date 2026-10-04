// Generate PWA icons (coffee leaf + cherry) from an inline SVG. Run: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'icons')
mkdirSync(out, { recursive: true })

// Leaf + cherry drawn inside the central 70% so the maskable safe zone holds.
const glyph = `
  <g transform="translate(256 262) rotate(-35)">
    <path d="M0 -150 C 92 -104 104 40 0 150 C -104 40 -92 -104 0 -150 Z" fill="#F4ECDC"/>
    <path d="M0 -128 L0 132" stroke="#2E6B3A" stroke-width="12" stroke-linecap="round"/>
    <path d="M0 -60 L44 -92 M0 -10 L54 -44 M0 40 L50 8 M0 -60 L-44 -92 M0 -10 L-54 -44 M0 40 L-50 8"
      stroke="#2E6B3A" stroke-width="9" stroke-linecap="round" fill="none"/>
  </g>
  <circle cx="352" cy="352" r="46" fill="#B3261E" stroke="#F4ECDC" stroke-width="12"/>`

const svg = (rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="#2E6B3A"/>${glyph}
</svg>`

writeFileSync(join(out, 'icon.svg'), svg(true))
writeFileSync(join(root, 'public', 'favicon.svg'), svg(true))
for (const size of [192, 512]) {
  await sharp(Buffer.from(svg(true))).resize(size, size).png().toFile(join(out, `icon-${size}.png`))
  await sharp(Buffer.from(svg(false))).resize(size, size).png().toFile(join(out, `maskable-${size}.png`))
}
await sharp(Buffer.from(svg(false))).resize(180, 180).png().toFile(join(out, 'apple-touch-icon.png'))
console.log('icons written to public/icons/')
