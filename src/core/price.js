// Fair-price reference for parchment coffee (pergamino). Pure, no I/O.
// Band = latest World Bank Pink Sheet Arabica (USD/kg) * FX (PEN/USD) * pass-through,
// where pass-through is the observed Peru farmgate / international ratio (FAOSTAT).
// This is a reference band, not a guaranteed price.

export const MAX_REFERENCE_AGE_MONTHS = 12 // older -> refuse
export const OLD_REFERENCE_WARN_MONTHS = 3 // older -> show a warning
export const IMPLAUSIBLE_FACTOR = 4 // offer > 4x band or < band/4 -> probably wrong unit

const fin = Number.isFinite

export function latestInternational(prices) {
  const series = prices?.international?.series
  if (!Array.isArray(series) || !series.length) return null
  const valid = series.filter((s) => fin(s.arabica_usd_kg) && s.month)
  if (!valid.length) return null
  const last = valid.reduce((m, s) => (s.month > m.month ? s : m), valid[0])
  return { month: last.month, usdKg: last.arabica_usd_kg, source: prices.international.source ?? null }
}

/**
 * @param prices contents of public/data/prices.json
 * @param fxOverride optional live FX {rate, asOf, source}
 */
export function referenceBand(prices, fxOverride = null) {
  const intl = latestInternational(prices)
  const pt = prices?.pass_through?.band
  const bundledFx = prices?.fx
  if (!intl || !Array.isArray(pt) || pt.length !== 2 || !fin(bundledFx?.pen_per_usd)) {
    return { status: 'unknown', reason: 'no_reference' }
  }
  const fx = fxOverride && fin(fxOverride.rate) && fxOverride.rate > 0
    ? { rate: fxOverride.rate, asOf: fxOverride.asOf ?? null, source: fxOverride.source ?? null }
    : { rate: bundledFx.pen_per_usd, asOf: bundledFx.as_of ?? null, source: bundledFx.source ?? null }
  const quintalKg = fin(prices?.units?.quintal_kg) ? prices.units.quintal_kg : 46
  const lowKg = intl.usdKg * fx.rate * pt[0]
  const highKg = intl.usdKg * fx.rate * pt[1]
  return {
    status: 'ok',
    lowKg, highKg,
    lowQq: lowKg * quintalKg, highQq: highKg * quintalKg,
    quintalKg, fx, intl, passThrough: pt,
  }
}

export function toPerKg(value, unit, quintalKg = 46) {
  return unit === 'qq' ? value / quintalKg : value
}

/** Whole calendar months from 'YYYY-MM' to a 'YYYY-MM-DD' date. */
export function monthsBetween(ym, date) {
  const [y1, m1] = ym.split('-').map(Number)
  const [y2, m2] = date.slice(0, 7).split('-').map(Number)
  return (y2 - y1) * 12 + (m2 - m1)
}

/**
 * @returns {{status:'below'|'inside'|'above'|'unknown', reason?:string, offerKg?:number, ageMonths?:number, oldReference?:boolean}}
 */
export function assessOffer({ offer, unit = 'kg', band, now }) {
  if (!band || band.status !== 'ok') return { status: 'unknown', reason: 'no_reference' }
  const ageMonths = monthsBetween(band.intl.month, now)
  if (ageMonths > MAX_REFERENCE_AGE_MONTHS) return { status: 'unknown', reason: 'stale', ageMonths }
  if (!fin(offer) || offer <= 0) return { status: 'unknown', reason: 'no_offer', ageMonths }
  const offerKg = toPerKg(offer, unit, band.quintalKg)
  if (offerKg > band.highKg * IMPLAUSIBLE_FACTOR || offerKg < band.lowKg / IMPLAUSIBLE_FACTOR) {
    return { status: 'unknown', reason: 'check_unit', offerKg, ageMonths }
  }
  const status = offerKg < band.lowKg ? 'below' : offerKg > band.highKg ? 'above' : 'inside'
  return { status, offerKg, ageMonths, oldReference: ageMonths > OLD_REFERENCE_WARN_MONTHS }
}
