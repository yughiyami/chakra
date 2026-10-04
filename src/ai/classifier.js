// On-device leaf classifier: onnxruntime-web (WASM, self-hosted under /ort/),
// lazy-loaded on first use. Preprocessing mirrors training exactly:
// squash-resize the WHOLE image to 224x224 (no crop), high-quality downscale,
// RGB, CHW, float32 in [0,1]. Normalization lives inside the ONNX graph.
import { decide, mahalanobisScore } from '../core/gates.js'
import { parseModelCard, summarizeModelCard } from '../core/modelCard.js'
import { rgbaToCHW } from '../core/tensor.js'
import { fetchJSON } from '../data/storage.js'

export const SIZE = 224

let cardPromise = null
let modelPromise = null

/** Model card + optional ood.json. Small; safe to call from any screen. */
export function loadModelInfo() {
  if (!cardPromise) {
    cardPromise = (async () => {
      let summary = null
      try {
        summary = summarizeModelCard(parseModelCard(await fetchJSON('/model/model_card.json', { text: true })))
      } catch {
        summary = null
      }
      let ood = null
      try {
        ood = await fetchJSON('/model/ood.json')
        if (!Array.isArray(ood?.feat_mean)) ood = null
      } catch {
        ood = null
      }
      return { summary, ood }
    })()
    cardPromise.catch(() => { cardPromise = null })
  }
  return cardPromise
}

async function loadSession() {
  const ort = await import('onnxruntime-web/wasm')
  ort.env.wasm.wasmPaths = '/ort/'
  ort.env.wasm.numThreads = 1
  const res = await fetch('/model/chakra.onnx')
  const type = res.headers.get('content-type') || ''
  if (!res.ok || type.includes('text/html')) throw new Error('model_missing')
  const buf = await res.arrayBuffer()
  const session = await ort.InferenceSession.create(buf, { executionProviders: ['wasm'] })
  return { ort, session }
}

export function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const [{ summary, ood }, { ort, session }] = await Promise.all([loadModelInfo(), loadSession()])
      return { ort, session, summary, ood }
    })()
    modelPromise.catch(() => { modelPromise = null })
  }
  return modelPromise
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/**
 * Decode (honouring EXIF orientation) and squash-resize to 224x224 by repeated
 * halving (approximates an antialiased downscale), then one final high-quality draw.
 * @returns {Promise<{rgba:Uint8ClampedArray, preview:string}>}
 */
export async function decodeToRGBA(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  let src = bmp
  let w = bmp.width
  let h = bmp.height
  while (w >= SIZE * 2 || h >= SIZE * 2) {
    const nw = w >= SIZE * 2 ? Math.floor(w / 2) : w
    const nh = h >= SIZE * 2 ? Math.floor(h / 2) : h
    const c = makeCanvas(nw, nh)
    const ctx = c.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src, 0, 0, nw, nh)
    src = c
    w = nw
    h = nh
  }
  const out = makeCanvas(SIZE, SIZE)
  const ctx = out.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, SIZE, SIZE)
  const rgba = ctx.getImageData(0, 0, SIZE, SIZE).data

  // Small aspect-preserving preview for the screen only (never stored or sent).
  const pw = 320
  const ph = Math.round((bmp.height / bmp.width) * pw)
  const pc = document.createElement('canvas')
  pc.width = pw
  pc.height = ph
  pc.getContext('2d').drawImage(bmp, 0, 0, pw, ph)
  const preview = pc.toDataURL('image/jpeg', 0.8)
  bmp.close?.()
  return { rgba, preview }
}

/** Run the model and the decision gates on a 224x224 RGBA buffer. */
export async function classify(rgba) {
  const { ort, session, summary, ood } = await loadModel()
  const input = new ort.Tensor('float32', rgbaToCHW(rgba, SIZE, SIZE), [1, 3, SIZE, SIZE])
  const out = await session.run({ image: input })
  const logits = Array.from(out.logits?.data ?? [])
  const features = out.features?.data ?? null
  const maha = features && ood ? mahalanobisScore(features, ood) : null
  const decision = decide(logits, summary?.gates, summary?.classes ?? null, { mahalanobis: maha })
  return { ...decision, logits }
}
