// Merge Open-Meteo archive (ERA5, ~5 day lag) with the forecast endpoint
// (which also returns recent past days) into one normalized daily series.
// Archive values win; gaps are filled from the forecast endpoint.

const FIELDS = {
  tmax: 'temperature_2m_max',
  tmin: 'temperature_2m_min',
  tmean: 'temperature_2m_mean',
  rain: 'precipitation_sum',
  rh: 'relative_humidity_2m_mean',
}

function toDays(resp) {
  const d = resp?.daily
  if (!d?.time) return new Map()
  const map = new Map()
  d.time.forEach((date, i) => {
    const day = { date }
    for (const [k, f] of Object.entries(FIELDS)) {
      const v = d[f]?.[i]
      day[k] = Number.isFinite(v) ? v : null
    }
    map.set(date, day)
  })
  return map
}

export function mergeOpenMeteo({ archive = null, forecast = null, today, lat = null, lon = null, retrievedAt = null }) {
  const a = toDays(archive)
  const f = toDays(forecast)
  const dates = [...new Set([...a.keys(), ...f.keys()])].sort()
  const days = dates.map((date) => {
    const av = a.get(date)
    const fv = f.get(date)
    const out = { date }
    for (const k of Object.keys(FIELDS)) out[k] = av?.[k] ?? fv?.[k] ?? null
    return out
  })
  return {
    source: 'Open-Meteo (archive ERA5 + forecast), CC BY 4.0',
    lat, lon,
    elevation: archive?.elevation ?? forecast?.elevation ?? null,
    today,
    retrieved_at: retrievedAt,
    days,
  }
}
