import { describe, it, expect } from 'vitest'
import {
  checkQuality, brightnessMean, laplacianVariance, leafRatio, toGray,
  BRIGHTNESS_MIN, BRIGHTNESS_MAX, BLUR_MIN_VARIANCE, LEAF_MIN_RATIO,
} from './quality.js'
import { rgbaToCHW } from './tensor.js'

const N = 224

function image(fn) {
  const px = new Uint8ClampedArray(N * N * 4)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const [r, g, b] = fn(x, y)
      const i = (y * N + x) * 4
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255
    }
  }
  return px
}

// Textured green leaf: alternating light/dark green 4px stripes
const sharpLeaf = image((x, y) => (((x >> 2) + (y >> 2)) % 2 ? [60, 170, 50] : [30, 100, 25]))
const flatLeaf = image(() => [50, 140, 40])
const black = image(() => [5, 5, 5])
const white = image(() => [250, 250, 250])
const grayChecker = image((x, y) => (((x >> 2) + (y >> 2)) % 2 ? [190, 190, 190] : [70, 70, 70]))

describe('quality constants', () => {
  it('exports the documented thresholds', () => {
    expect(BRIGHTNESS_MIN).toBe(40)
    expect(BRIGHTNESS_MAX).toBe(220)
    expect(BLUR_MIN_VARIANCE).toBe(60)
    expect(LEAF_MIN_RATIO).toBe(0.15)
  })
})

describe('metrics', () => {
  it('brightness mean of a constant image equals its luma', () => {
    expect(brightnessMean(white, N, N)).toBeCloseTo(250, 0)
    expect(brightnessMean(black, N, N)).toBeCloseTo(5, 0)
  })

  it('variance of Laplacian is 0 for flat images and high for texture', () => {
    expect(laplacianVariance(toGray(flatLeaf, N, N), N, N)).toBe(0)
    expect(laplacianVariance(toGray(sharpLeaf, N, N), N, N)).toBeGreaterThan(BLUR_MIN_VARIANCE)
  })

  it('leaf ratio counts green-dominant saturated pixels only', () => {
    expect(leafRatio(sharpLeaf, N, N)).toBeCloseTo(1, 5)
    expect(leafRatio(grayChecker, N, N)).toBe(0)
    expect(leafRatio(white, N, N)).toBe(0)
  })
})

describe('checkQuality', () => {
  it('passes a sharp, well-lit leaf', () => {
    const q = checkQuality(sharpLeaf, N, N)
    expect(q.ok).toBe(true)
    expect(q.issues).toEqual([])
    expect(q.metrics.brightness).toBeGreaterThan(40)
  })

  it('flags a dark photo with "dark" first', () => {
    const q = checkQuality(black, N, N)
    expect(q.ok).toBe(false)
    expect(q.issues[0]).toBe('dark')
  })

  it('flags an overexposed photo', () => {
    expect(checkQuality(white, N, N).issues[0]).toBe('bright')
  })

  it('flags a blurry leaf', () => {
    expect(checkQuality(flatLeaf, N, N).issues).toEqual(['blurry'])
  })

  it('flags a sharp photo without a leaf', () => {
    expect(checkQuality(grayChecker, N, N).issues).toEqual(['no_leaf'])
  })

  it('rejects wrong-size buffers', () => {
    expect(checkQuality(new Uint8ClampedArray(10), N, N).issues).toEqual(['invalid'])
  })
})

describe('rgbaToCHW (preprocess parity: RGB, CHW, [0,1], alpha dropped, no normalization)', () => {
  it('converts a 2x1 image', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 51, 255, 0])
    const t = rgbaToCHW(rgba, 2, 1)
    expect(t).toBeInstanceOf(Float32Array)
    expect(Array.from(t)).toEqual([1, 0, 0, 0.2, 0, 1].map(Math.fround))
  })

  it('produces 3*224*224 values', () => {
    expect(rgbaToCHW(sharpLeaf, N, N)).toHaveLength(3 * N * N)
  })
})
