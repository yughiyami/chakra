// Weather-driven pest & disease risk rules. Pure functions, no I/O.
// Each rule cites its source; combinations marked "Chakra heuristic" are ours,
// not from the cited papers. Every function returns {status:'unknown', reason}
// instead of guessing when inputs are missing.
//
// Day shape: { date:'YYYY-MM-DD', tmax, tmin, tmean, rain, rh } (°C, mm, %)

export const MIN_VALID_DAYS = 25 // of the last 30 days
export const STALE_AFTER_DAYS = 3
export const LAPSE_RATE_C_PER_100M = 0.6
export const BROCA_BASE_C = 14.9 // Jaramillo et al. 2009
export const BROCA_MAX_C = 32
export const BROCA_TARGET_DD = 332 // one generation, Jaramillo et al. 2009
export const BROCA_DEFAULT_START_DAYS = 60
export const DIURNAL_DROP_C = 1.0

const DAY_MS = 86400000
const toMs = (d) => Date.parse(`${d}T00:00:00Z`)

export function addDays(date, n) {
  return new Date(toMs(date) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Whole days from a to b (b - a). Accepts 'YYYY-MM-DD' or ISO timestamps. */
export function daysBetween(a, b) {
  return Math.round((toMs(a.slice(0, 10)) - toMs(b.slice(0, 10))) / -DAY_MS)
}

const fin = Number.isFinite
export const isValidDay = (d) => d != null && fin(d.tmax) && fin(d.tmin) && fin(d.rain)
const tmeanOf = (d) => (fin(d.tmean) ? d.tmean : (d.tmax + d.tmin) / 2)
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length

/** Days whose date is in [end-(n-1), end]. */
export function windowDays(days, end, n) {
  const start = addDays(end, -(n - 1))
  return days.filter((d) => d.date >= start && d.date <= end)
}

function lastValid(days, n) {
  if (!days.length) return { valid: [], end: null }
  const end = days.reduce((m, d) => (d.date > m ? d.date : m), days[0].date)
  return { valid: windowDays(days, end, n).filter(isValidDay), end }
}

const unknown = (reason, extra = {}) => ({ status: 'unknown', reason, ...extra })

/**
 * ExpeRoya monthly classes — Motisi et al. 2022, Agricultural Systems.
 * Over the last 30 days:
 *  infection: days rain >= 5 mm   >7 high, 3–7 medium, <3 low
 *  latency:   days Tmean in 22–24  >10 short, 5–10 medium, <5 long
 *  wash-off:  days rain >= 10 mm  >5 sufficient, 3–5 regular, <3 insufficient
 * Overall risk (Chakra heuristic, NOT from the paper):
 *  HIGH if infection high and latency short/medium;
 *  MEDIUM if infection medium/high or latency short; else LOW.
 */
export function experoya(days) {
  const { valid } = lastValid(days, 30)
  if (valid.length < MIN_VALID_DAYS) return unknown('insufficient_data', { validDays: valid.length })
  const inf = valid.filter((d) => d.rain >= 5).length
  const lat = valid.filter((d) => { const t = tmeanOf(d); return t >= 22 && t <= 24 }).length
  const wash = valid.filter((d) => d.rain >= 10).length
  const infection = { days: inf, level: inf > 7 ? 'high' : inf >= 3 ? 'medium' : 'low' }
  const latency = { days: lat, level: lat > 10 ? 'short' : lat >= 5 ? 'medium' : 'long' }
  const washoff = { days: wash, level: wash > 5 ? 'sufficient' : wash >= 3 ? 'regular' : 'insufficient' }
  let risk = 'low'
  if (infection.level === 'high' && latency.level !== 'long') risk = 'high'
  else if (infection.level !== 'low' || latency.level === 'short') risk = 'medium'
  return { status: 'ok', infection, latency, washoff, risk, validDays: valid.length }
}

/**
 * Rust incubation period (days from infection to visible lesions) —
 * Moraes et al. 1976, as reported by Alfonsi et al. 2019 (Pesq. Agropec. Bras.).
 *  sun:   Y = 93.27 - 0.99*Tx - 1.51*Tn
 *  shade: Y = 113.92 - 1.02*Tx - 2.69*Tn
 * Tx/Tn = mean daily max/min over the last 30 days. Clamped to [15, 60];
 * < 19 days is the most severe class.
 */
export function incubationDays(days, shade = false) {
  const { valid } = lastValid(days, 30)
  if (valid.length < MIN_VALID_DAYS) return unknown('insufficient_data', { validDays: valid.length })
  const tx = mean(valid.map((d) => d.tmax))
  const tn = mean(valid.map((d) => d.tmin))
  const raw = shade ? 113.92 - 1.02 * tx - 2.69 * tn : 93.27 - 0.99 * tx - 1.51 * tn
  const clamped = Math.min(60, Math.max(15, raw))
  return { status: 'ok', days: Math.round(clamped), raw, tx, tn, shade, severe: clamped < 19 }
}

/**
 * Narrow diurnal temperature range — Avelino et al. 2015 (Food Security)
 * linked the 2012–13 Central American epidemic to reduced daily ranges.
 * Flag if mean(Tmax - Tmin) over the last 30 days is >= 1.0 °C below the mean
 * over days 31–90 (Chakra operationalisation).
 */
export function diurnalRangeSignal(days) {
  const valid = days.filter(isValidDay)
  if (!valid.length) return unknown('insufficient_data')
  const end = valid.reduce((m, d) => (d.date > m ? d.date : m), valid[0].date)
  const recentStart = addDays(end, -29)
  const baseStart = addDays(end, -89)
  const recent = valid.filter((d) => d.date >= recentStart)
  const base = valid.filter((d) => d.date >= baseStart && d.date < recentStart)
  if (recent.length < MIN_VALID_DAYS || base.length < MIN_VALID_DAYS) {
    return unknown('insufficient_data', { validDays: recent.length, baselineDays: base.length })
  }
  const r = mean(recent.map((d) => d.tmax - d.tmin))
  const b = mean(base.map((d) => d.tmax - d.tmin))
  return { status: 'ok', recent: r, baseline: b, drop: b - r, flag: b - r >= DIURNAL_DROP_C }
}

/** Daily degree-days for the coffee berry borer (base 14.9 °C, Tmean capped at 32 °C). */
export function degreeDay(d) {
  return Math.max(0, Math.min(tmeanOf(d), BROCA_MAX_C) - BROCA_BASE_C)
}

/**
 * Broca degree-day accumulation — Jaramillo et al. 2009 (PLoS ONE);
 * Hamilton et al. 2019 (PLoS ONE). 332 DD ≈ one generation emerging.
 * Accumulates observed days from `startDate`, then projects with forecast days.
 */
export function brocaDegreeDays(observed, forecast, startDate, target = BROCA_TARGET_DD) {
  const obs = observed.filter(isValidDay).sort((a, b) => (a.date < b.date ? -1 : 1))
  if (!obs.length || !startDate) return unknown('insufficient_data')
  const end = obs[obs.length - 1].date
  if (startDate > end) return unknown('future_start')
  const span = daysBetween(startDate, end) + 1
  const inRange = obs.filter((d) => d.date >= startDate)
  if (inRange.length < Math.ceil(span * 0.9)) return unknown('insufficient_data', { validDays: inRange.length, span })

  let dd = 0
  let reachedDate = null
  for (const d of inRange) {
    dd += degreeDay(d)
    if (reachedDate == null && dd >= target) reachedDate = d.date
  }
  let projectedDate = reachedDate
  if (projectedDate == null) {
    let acc = dd
    for (const d of (forecast ?? []).filter((f) => f.date > end && isValidDay(f)).sort((a, b) => (a.date < b.date ? -1 : 1))) {
      acc += degreeDay(d)
      if (acc >= target) { projectedDate = d.date; break }
    }
  }
  return {
    status: 'ok', dd, target, startDate, endDate: end,
    reached: reachedDate != null, reachedDate,
    projectedDate: reachedDate ?? projectedDate ?? null,
  }
}

/**
 * Altitude correction with a standard lapse rate (~0.6 °C / 100 m). Approximation:
 * T_farm = T_grid - 0.6 * (alt_farm - elev_grid) / 100. Rain/RH unchanged.
 */
export function altitudeDelta(farmAltitude, gridElevation) {
  if (!fin(farmAltitude) || !fin(gridElevation)) return 0
  return -LAPSE_RATE_C_PER_100M * (farmAltitude - gridElevation) / 100
}

export function correctAltitude(days, farmAltitude, gridElevation) {
  const delta = altitudeDelta(farmAltitude, gridElevation)
  if (delta === 0) return days.map((d) => ({ ...d }))
  const shift = (v) => (fin(v) ? v + delta : v)
  return days.map((d) => ({ ...d, tmax: shift(d.tmax), tmin: shift(d.tmin), tmean: shift(d.tmean) }))
}

/** Newest valid day strictly before `today` (observed, not forecast). */
export function newestObservedDate(days, today) {
  let best = null
  for (const d of days) if (d.date < today && isValidDay(d) && (best == null || d.date > best)) best = d.date
  return best
}

/**
 * Composite assessment for the Clima screen.
 * status: 'ok' | 'stale' (newest observation > 3 days old; refused unless demo) | 'insufficient'
 */
export function assessWeather({
  days, today, now, farmAltitude = null, gridElevation = null,
  shade = false, brocaStart = null, demo = false,
}) {
  const all = Array.isArray(days) ? days : []
  const delta = altitudeDelta(farmAltitude, gridElevation)
  const corrected = correctAltitude(all, farmAltitude, gridElevation)
  const observed = corrected.filter((d) => d.date < today)
  const forecast = corrected.filter((d) => d.date >= today)
  const newest = newestObservedDate(observed, today)
  const base = { demo, altitudeDelta: delta, newestObserved: newest }
  if (!newest) return { ...base, status: 'insufficient', reason: 'no_data' }

  const ageDays = daysBetween(newest, now)
  const stale = ageDays > STALE_AFTER_DAYS
  if (stale && !demo) return { ...base, status: 'stale', reason: 'old_data', ageDays, stale }

  const obsValid = observed.filter(isValidDay)
  if (windowDays(obsValid, newest, 30).length < MIN_VALID_DAYS) {
    return { ...base, status: 'insufficient', reason: 'insufficient_data', ageDays, stale }
  }
  const start = brocaStart ?? addDays(newest, -BROCA_DEFAULT_START_DAYS)
  const first = obsValid.reduce((m, d) => (d.date < m ? d.date : m), newest)
  return {
    ...base,
    status: 'ok',
    ageDays,
    stale,
    observedRange: [first, newest],
    rust: experoya(obsValid),
    incubation: incubationDays(obsValid, shade),
    diurnal: diurnalRangeSignal(obsValid),
    broca: brocaDegreeDays(obsValid, forecast, start),
  }
}
