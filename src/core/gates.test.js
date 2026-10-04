import { describe, it, expect } from 'vitest'
import { softmax, logsumexp, energyScore, decide, CLASSES } from './gates.js'

// Fixture gates (NOT the real model's): T=2, qhat=0.9 -> include class if p >= 0.1
const GATES = { temperature: 2, qhat: 0.9, energy_threshold: -3, alpha: 0.1, n_calib: 100 }

describe('softmax / logsumexp / energy', () => {
  it('softmax sums to 1 and respects temperature', () => {
    const p = softmax([2, 1, 0], 1)
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    expect(p[0]).toBeGreaterThan(p[1])
    const flat = softmax([2, 1, 0], 100)
    expect(flat[0] - flat[2]).toBeLessThan(p[0] - p[2])
  })

  it('logsumexp is numerically stable for large logits', () => {
    expect(logsumexp([1000, 1000])).toBeCloseTo(1000 + Math.log(2), 8)
    expect(Number.isFinite(logsumexp([-1000, -1000]))).toBe(true)
  })

  it('energy = -T * logsumexp(z / T)', () => {
    const z = [10, 0, 0, 0, 0]
    const expected = -2 * Math.log(Math.exp(5) + 4)
    expect(energyScore(z, 2)).toBeCloseTo(expected, 10)
  })
})

describe('decide (mirror of Python gate logic)', () => {
  it('answers when energy is familiar and the conformal set is a singleton', () => {
    const r = decide([10, 0, 0, 0, 0], GATES)
    expect(r.status).toBe('answer')
    expect(r.label).toBe('healthy')
    expect(r.set).toEqual(['healthy'])
    expect(r.probs).toHaveLength(5)
    expect(r.energy).toBeLessThan(GATES.energy_threshold)
  })

  it('abstains as unfamiliar when energy exceeds the threshold', () => {
    const r = decide([-5, -5, -5, -5, -5], GATES)
    expect(r.status).toBe('abstain')
    expect(r.reason).toBe('unfamiliar')
    expect(r.energy).toBeGreaterThan(GATES.energy_threshold)
  })

  it('abstains as ambiguous listing candidates when the set has >1 class', () => {
    const r = decide([6, 6, 0, 0, 0], GATES)
    expect(r.status).toBe('abstain')
    expect(r.reason).toBe('ambiguous')
    expect(r.set).toEqual(['healthy', 'leaf_miner'])
  })

  it('abstains as unfamiliar when the conformal set is empty', () => {
    const r = decide([1, 1, 1, 0, 0], { ...GATES, qhat: 0.5, energy_threshold: 100 })
    expect(r.status).toBe('abstain')
    expect(r.reason).toBe('unfamiliar')
    expect(r.set).toEqual([])
  })

  it('uses the inclusive threshold p_k >= 1 - qhat', () => {
    // Two classes with equal logits and qhat=0.5 -> p=0.5 each -> both included
    const r = decide([0, 0, -1000, -1000, -1000], { ...GATES, temperature: 1, qhat: 0.5, energy_threshold: 100 })
    expect(r.set).toEqual(['healthy', 'leaf_miner'])
  })

  it('abstains with no_model when gates are missing or invalid', () => {
    expect(decide([10, 0, 0, 0, 0], null).reason).toBe('no_model')
    expect(decide([10, 0, 0, 0, 0], { temperature: 0, qhat: 0.9, energy_threshold: 0 }).reason).toBe('no_model')
  })

  it('abstains with invalid on wrong-length or non-finite logits', () => {
    expect(decide([1, 2, 3], GATES).reason).toBe('invalid')
    expect(decide([NaN, 0, 0, 0, 0], GATES).reason).toBe('invalid')
  })

  it('accepts custom class names', () => {
    const classes = ['a', 'b', 'c', 'd', 'e']
    expect(decide([0, 10, 0, 0, 0], GATES, classes).label).toBe('b')
    expect(CLASSES).toEqual(['healthy', 'leaf_miner', 'rust', 'brown_leaf_spot', 'cercospora'])
  })
})
