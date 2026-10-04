// Photo quality gate, run BEFORE the model on the 224x224 RGBA buffer.
// A bad photo gets specific retake advice instead of a (meaningless) prediction.

export const BRIGHTNESS_MIN = 40 // mean luma, 0-255
export const BRIGHTNESS_MAX = 220
export const BLUR_MIN_VARIANCE = 60 // variance of the Laplacian on grayscale (tunable)
export const LEAF_MIN_RATIO = 0.15 // fraction of green/leaf pixels

const MIN_SATURATION = 0.12
const MIN_VALUE = 0.1

export function toGray(rgba, w, h) {
  const g = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const j = i * 4
    g[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2]
  }
  return g
}

export function brightnessMean(rgba, w, h) {
  const g = toGray(rgba, w, h)
  let s = 0
  for (let i = 0; i < g.length; i++) s += g[i]
  return s / g.length
}

/** Variance of the 4-neighbour Laplacian over interior pixels. */
export function laplacianVariance(gray, w, h) {
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const lap = gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i]
      sum += lap
      sumSq += lap * lap
      n++
    }
  }
  if (n === 0) return 0
  const mean = sum / n
  return Math.max(0, sumSq / n - mean * mean)
}

/**
 * Leaf pixel: green channel dominant (g > r and g > b) or HSV hue in [60, 180] deg,
 * with a minimum saturation/value so grey paper and shadows do not count.
 */
export function isLeafPixel(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const v = max / 255
  const s = max === 0 ? 0 : (max - min) / max
  if (s < MIN_SATURATION || v < MIN_VALUE) return false
  if (g > r && g > b) return true
  let hue
  if (max === r) hue = 60 * (((g - b) / (max - min)) % 6)
  else if (max === g) hue = 60 * ((b - r) / (max - min) + 2)
  else hue = 60 * ((r - g) / (max - min) + 4)
  if (hue < 0) hue += 360
  return hue >= 60 && hue <= 180
}

export function leafRatio(rgba, w, h) {
  let n = 0
  for (let i = 0; i < w * h; i++) {
    const j = i * 4
    if (isLeafPixel(rgba[j], rgba[j + 1], rgba[j + 2])) n++
  }
  return n / (w * h)
}

/**
 * @returns {{ok:boolean, issues:string[], metrics:{brightness?:number, blur?:number, leaf?:number}}}
 * issues are ordered by what the farmer should fix first:
 * 'dark' | 'bright' -> 'blurry' -> 'no_leaf'
 */
export function checkQuality(rgba, w, h) {
  if (!rgba || rgba.length !== w * h * 4) return { ok: false, issues: ['invalid'], metrics: {} }
  const gray = toGray(rgba, w, h)
  let s = 0
  for (let i = 0; i < gray.length; i++) s += gray[i]
  const brightness = s / gray.length
  const blur = laplacianVariance(gray, w, h)
  const leaf = leafRatio(rgba, w, h)

  const issues = []
  if (brightness < BRIGHTNESS_MIN) issues.push('dark')
  else if (brightness > BRIGHTNESS_MAX) issues.push('bright')
  if (blur < BLUR_MIN_VARIANCE) issues.push('blurry')
  if (leaf < LEAF_MIN_RATIO) issues.push('no_leaf')
  return { ok: issues.length === 0, issues, metrics: { brightness, blur, leaf } }
}
