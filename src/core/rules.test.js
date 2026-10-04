import { describe, it, expect } from 'vitest'
import {
  addDays, daysBetween, isValidDay, windowDays,
  experoya, incubationDays, diurnalRangeSignal, brocaDegreeDays, degreeDay,
  correctAltitude, newestObservedDate, assessWeather,
  MIN_VALID_DAYS, STALE_AFTER_DAYS, BROCA_TARGET_DD,
} from './rules.js'

// Build N consecutive days ending at `end` (inclusive) with a generator.
function series(end, n, fn) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(end, -i)
    out.push({ date, ...fn(n - 1 - i, date) })
  }
  return out
}
const base = { tmax: 26, tmin: 16, tmean: 21, rain: 0, rh: 80 }

describe('date helpers', () => {
  it('adds days and measures gaps in UTC', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-10-01', '2026-10-04')).toBe(3)
  })
  it('validates days', () => {
    expect(isValidDay(base)).toBe(true)
    expect(isValidDay({ ...base, rain: null })).toBe(false)
    expect(isValidDay({ ...base, tmax: NaN })).toBe(false)
  })
  it('exports the documented constants', () => {
    expect(MIN_VALID_DAYS).toBe(25)
    expect(STALE_AFTER_DAYS).toBe(3)
    expect(BROCA_TARGET_DD).toBe(332)
  })
})

describe('ExpeRoya monthly classes (Motisi et al. 2022)', () => {
  const end = '2026-09-30'
  it('classifies high infection + short latency as HIGH risk', () => {
    // 10 days rain>=5 (of which 6 >=10mm), 12 days Tmean in [22,24]
    const days = series(end, 30, (i) => ({
      ...base,
      rain: i < 6 ? 12 : i < 10 ? 6 : 0,
      tmean: i < 12 ? 23 : 20,
    }))
    const r = experoya(days)
    expect(r.status).toBe('ok')
    expect(r.infection).toEqual({ days: 10, level: 'high' })
    expect(r.latency).toEqual({ days: 12, level: 'short' })
    expect(r.washoff).toEqual({ days: 6, level: 'sufficient' })
    expect(r.risk).toBe('high')
  })

  it('handles class boundaries (3-7 medium, 5-10 medium, 3-5 regular)', () => {
    const days = series(end, 30, (i) => ({ ...base, rain: i < 3 ? 11 : i < 7 ? 5 : 0, tmean: i < 5 ? 22 : 25 }))
    const r = experoya(days)
    expect(r.infection.level).toBe('medium') // 7 days
    expect(r.latency.level).toBe('medium') // 5 days
    expect(r.washoff.level).toBe('regular') // 3 days
    expect(r.risk).toBe('medium')
  })

  it('is MEDIUM when only latency is short', () => {
    const days = series(end, 30, (i) => ({ ...base, tmean: i < 11 ? 23 : 20 }))
    expect(experoya(days).risk).toBe('medium')
  })

  it('is LOW with dry, cool weather', () => {
    const r = experoya(series(end, 30, () => base))
    expect(r.infection.level).toBe('low')
    expect(r.latency.level).toBe('long')
    expect(r.washoff.level).toBe('insufficient')
    expect(r.risk).toBe('low')
  })

  it('returns unknown with fewer than 25 valid days', () => {
    const days = series(end, 30, (i) => (i < 6 ? { ...base, rain: null } : base))
    const r = experoya(days)
    expect(r.status).toBe('unknown')
    expect(r.reason).toBe('insufficient_data')
    expect(r.validDays).toBe(24)
  })
})

describe('incubation period (Moraes et al. 1976 via Alfonsi et al. 2019)', () => {
  const end = '2026-09-30'
  it('computes the sun equation from mean Tmax/Tmin', () => {
    const r = incubationDays(series(end, 30, () => ({ ...base, tmax: 28, tmin: 18 })), false)
    expect(r.status).toBe('ok')
    expect(r.raw).toBeCloseTo(93.27 - 0.99 * 28 - 1.51 * 18, 6)
    expect(r.days).toBe(Math.round(93.27 - 0.99 * 28 - 1.51 * 18))
    expect(r.severe).toBe(false)
  })
  it('computes the shade equation', () => {
    const r = incubationDays(series(end, 30, () => ({ ...base, tmax: 28, tmin: 18 })), true)
    expect(r.raw).toBeCloseTo(113.92 - 1.02 * 28 - 2.69 * 18, 6)
  })
  it('clamps to [15, 60] and flags < 19 days as most severe', () => {
    // 93.27 - 0.99*35 - 1.51*28 = 16.34
    const hot = incubationDays(series(end, 30, () => ({ ...base, tmax: 35, tmin: 28 })), false)
    expect(hot.days).toBe(16)
    expect(hot.severe).toBe(true)
    const cold = incubationDays(series(end, 30, () => ({ ...base, tmax: 10, tmin: 2 })), false)
    expect(cold.days).toBe(60)
    const veryHot = incubationDays(series(end, 30, () => ({ ...base, tmax: 40, tmin: 30 })), false)
    expect(veryHot.days).toBe(15)
  })
  it('returns unknown with insufficient data', () => {
    expect(incubationDays(series(end, 10, () => base)).status).toBe('unknown')
  })
})

describe('narrow diurnal range signal (Avelino et al. 2015)', () => {
  const end = '2026-09-30'
  it('flags when the last 30 days range is >=1.0 C narrower than days 31-90', () => {
    const days = series(end, 90, (i) => (i >= 60 ? { ...base, tmax: 24, tmin: 17 } : { ...base, tmax: 26, tmin: 16 }))
    const r = diurnalRangeSignal(days)
    expect(r.status).toBe('ok')
    expect(r.recent).toBeCloseTo(7)
    expect(r.baseline).toBeCloseTo(10)
    expect(r.drop).toBeCloseTo(3)
    expect(r.flag).toBe(true)
  })
  it('does not flag small changes', () => {
    const days = series(end, 90, (i) => (i >= 60 ? { ...base, tmax: 25.5, tmin: 16 } : base))
    expect(diurnalRangeSignal(days).flag).toBe(false)
  })
  it('is unknown without enough baseline days', () => {
    expect(diurnalRangeSignal(series(end, 40, () => base)).status).toBe('unknown')
  })
})

describe('broca degree-days (Jaramillo et al. 2009; Hamilton et al. 2019)', () => {
  it('uses base 14.9 C and caps Tmean at 32 C', () => {
    expect(degreeDay({ tmean: 20 })).toBeCloseTo(5.1)
    expect(degreeDay({ tmean: 10 })).toBe(0)
    expect(degreeDay({ tmean: 40 })).toBeCloseTo(32 - 14.9)
  })
  it('falls back to (tmax+tmin)/2 when tmean is missing', () => {
    expect(degreeDay({ tmax: 26, tmin: 14, tmean: null })).toBeCloseTo(5.1)
  })
  it('accumulates from the start date and projects with forecast days', () => {
    // Tmean 20 -> 5.1 DD/day. 40 observed days = 204 DD. Need 128 more -> 26 forecast days (>16 available)
    const observed = series('2026-09-30', 40, () => ({ ...base, tmean: 20 }))
    const forecast = series('2026-10-16', 16, () => ({ ...base, tmean: 26 })) // 11.1 DD/day
    const r = brocaDegreeDays(observed, forecast, '2026-08-22')
    expect(r.status).toBe('ok')
    expect(r.dd).toBeCloseTo(204, 1)
    expect(r.reached).toBe(false)
    // 128/11.1 = 11.53 -> 12th forecast day = 2026-10-12
    expect(r.projectedDate).toBe('2026-10-12')
    expect(r.target).toBe(332)
  })
  it('reports reached when the observed sum already passed the target', () => {
    const observed = series('2026-09-30', 60, () => ({ ...base, tmean: 22 })) // 7.1/day -> 47th day
    const r = brocaDegreeDays(observed, [], '2026-08-02')
    expect(r.reached).toBe(true)
    expect(r.reachedDate).toBe(addDays('2026-08-02', 46))
  })
  it('returns null projection when the forecast does not reach the target', () => {
    const observed = series('2026-09-30', 10, () => ({ ...base, tmean: 15 }))
    const r = brocaDegreeDays(observed, series('2026-10-16', 16, () => ({ ...base, tmean: 15 })), '2026-09-21')
    expect(r.projectedDate).toBeNull()
  })
  it('is unknown when the start is in the future or data has gaps', () => {
    const observed = series('2026-09-30', 30, () => base)
    expect(brocaDegreeDays(observed, [], '2026-10-10').status).toBe('unknown')
    expect(brocaDegreeDays(observed, [], '2026-06-01').reason).toBe('insufficient_data')
  })
})

describe('altitude correction (lapse rate 0.6 C / 100 m)', () => {
  it('cools a farm above the grid cell', () => {
    const [d] = correctAltitude([{ ...base }], 1700, 1200)
    expect(d.tmax).toBeCloseTo(26 - 3)
    expect(d.tmin).toBeCloseTo(16 - 3)
    expect(d.tmean).toBeCloseTo(21 - 3)
    expect(d.rain).toBe(0)
  })
  it('is a no-op without both altitudes', () => {
    expect(correctAltitude([base], null, 1200)[0].tmax).toBe(26)
  })
})

describe('assessWeather (composite + staleness)', () => {
  const today = '2026-10-04'
  const observed = series('2026-10-03', 90, (i) => ({ ...base, rain: i % 3 === 0 ? 8 : 0, tmean: 23 }))
  const forecast = series('2026-10-19', 16, () => ({ ...base, tmean: 23 }))
  const days = [...observed, ...forecast]

  it('computes all signals with fresh data', () => {
    const r = assessWeather({ days, today, now: '2026-10-04' })
    expect(r.status).toBe('ok')
    expect(newestObservedDate(days, today)).toBe('2026-10-03')
    expect(r.rust.status).toBe('ok')
    expect(r.incubation.status).toBe('ok')
    expect(r.broca.status).toBe('ok')
    expect(r.observedRange).toEqual(['2026-07-06', '2026-10-03'])
  })

  it('refuses (stale) when newest observed day is older than 3 days', () => {
    const r = assessWeather({ days, today, now: '2026-10-10' })
    expect(r.status).toBe('stale')
    expect(r.ageDays).toBe(7)
    expect(r.rust).toBeUndefined()
  })

  it('still computes for the demo snapshot but labels it', () => {
    const r = assessWeather({ days, today, now: '2026-12-01', demo: true })
    expect(r.status).toBe('ok')
    expect(r.demo).toBe(true)
    expect(r.stale).toBe(true)
  })

  it('returns insufficient with too few observed days', () => {
    const r = assessWeather({ days: series('2026-10-03', 10, () => base), today, now: today })
    expect(r.status).toBe('insufficient')
  })

  it('applies the altitude correction before rules', () => {
    const warm = assessWeather({ days, today, now: today })
    const cool = assessWeather({ days, today, now: today, farmAltitude: 2000, gridElevation: 1000 })
    expect(cool.broca.dd).toBeLessThan(warm.broca.dd)
    expect(cool.altitudeDelta).toBeCloseTo(-6)
  })

  it('selects a 30-day window ending at the newest observed day', () => {
    expect(windowDays(observed, '2026-10-03', 30)).toHaveLength(30)
  })
})
