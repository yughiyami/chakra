import { describe, it, expect } from 'vitest'
import {
  latestInternational, referenceBand, toPerKg, assessOffer, monthsBetween,
  MAX_REFERENCE_AGE_MONTHS, OLD_REFERENCE_WARN_MONTHS,
} from './price.js'

// Mirrors the structure and numbers of public/data/prices.json
const PRICES = {
  as_of: '2025-12',
  international: {
    source: 'World Bank Pink Sheet',
    series: [
      { month: '2025-11', arabica_usd_kg: 9.05 },
      { month: '2025-12', arabica_usd_kg: 8.4 },
    ],
  },
  pass_through: { band: [0.51, 0.58] },
  fx: { pen_per_usd: 3.76, source: 'FAOSTAT implied', as_of: '2024' },
  units: { quintal_kg: 46 },
}

describe('reference band', () => {
  it('picks the latest month', () => {
    expect(latestInternational(PRICES)).toEqual({ month: '2025-12', usdKg: 8.4, source: 'World Bank Pink Sheet' })
  })

  it('computes S/ per kg and per 46 kg quintal from arabica * fx * pass-through', () => {
    const b = referenceBand(PRICES)
    expect(b.status).toBe('ok')
    expect(b.lowKg).toBeCloseTo(8.4 * 3.76 * 0.51, 6)
    expect(b.highKg).toBeCloseTo(8.4 * 3.76 * 0.58, 6)
    expect(b.lowQq).toBeCloseTo(b.lowKg * 46, 6)
    expect(b.quintalKg).toBe(46)
    expect(b.fx).toEqual({ rate: 3.76, asOf: '2024', source: 'FAOSTAT implied' })
    expect(b.intl.month).toBe('2025-12')
  })

  it('uses a live FX override with its own date', () => {
    const b = referenceBand(PRICES, { rate: 3.5, asOf: '2026-10-03', source: 'open.er-api.com' })
    expect(b.highKg).toBeCloseTo(8.4 * 3.5 * 0.58, 6)
    expect(b.fx.asOf).toBe('2026-10-03')
  })

  it('ignores an invalid FX override', () => {
    expect(referenceBand(PRICES, { rate: -1 }).fx.rate).toBe(3.76)
  })

  it('is unknown without data', () => {
    expect(referenceBand(null).status).toBe('unknown')
    expect(referenceBand({ ...PRICES, international: { series: [] } }).status).toBe('unknown')
  })
})

describe('units and dates', () => {
  it('converts per-quintal offers to per kg', () => {
    expect(toPerKg(460, 'qq', 46)).toBe(10)
    expect(toPerKg(12, 'kg', 46)).toBe(12)
  })
  it('counts whole months between a YYYY-MM and a date', () => {
    expect(monthsBetween('2025-12', '2026-10-04')).toBe(10)
    expect(monthsBetween('2026-10', '2026-10-04')).toBe(0)
  })
  it('exports age limits', () => {
    expect(MAX_REFERENCE_AGE_MONTHS).toBe(12)
    expect(OLD_REFERENCE_WARN_MONTHS).toBe(3)
  })
})

describe('assessOffer', () => {
  const band = referenceBand(PRICES) // ~16.11 - 18.32 S/ per kg
  const now = '2026-10-04'

  it('flags offers below the band', () => {
    const r = assessOffer({ offer: 14, unit: 'kg', band, now })
    expect(r.status).toBe('below')
    expect(r.offerKg).toBe(14)
    expect(r.ageMonths).toBe(10)
    expect(r.oldReference).toBe(true)
  })
  it('accepts offers inside the band (inclusive)', () => {
    expect(assessOffer({ offer: 17, unit: 'kg', band, now }).status).toBe('inside')
    expect(assessOffer({ offer: band.lowKg, unit: 'kg', band, now }).status).toBe('inside')
  })
  it('flags offers above the band', () => {
    expect(assessOffer({ offer: 19, unit: 'kg', band, now }).status).toBe('above')
  })
  it('handles per-quintal offers', () => {
    const r = assessOffer({ offer: 800, unit: 'qq', band, now })
    expect(r.offerKg).toBeCloseTo(800 / 46, 6)
    expect(r.status).toBe('inside')
  })
  it('refuses empty, zero or non-numeric offers', () => {
    expect(assessOffer({ offer: 0, unit: 'kg', band, now }).reason).toBe('no_offer')
    expect(assessOffer({ offer: NaN, unit: 'kg', band, now }).status).toBe('unknown')
  })
  it('refuses implausible offers (probably wrong unit)', () => {
    const r = assessOffer({ offer: 750, unit: 'kg', band, now })
    expect(r.status).toBe('unknown')
    expect(r.reason).toBe('check_unit')
  })
  it('refuses when the reference is older than 12 months', () => {
    const r = assessOffer({ offer: 17, unit: 'kg', band, now: '2027-01-15' })
    expect(r.status).toBe('unknown')
    expect(r.reason).toBe('stale')
  })
  it('refuses without a band', () => {
    expect(assessOffer({ offer: 17, unit: 'kg', band: { status: 'unknown' }, now }).reason).toBe('no_reference')
  })
})
