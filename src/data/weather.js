// Weather data access: live Open-Meteo when online, localStorage cache otherwise,
// and the bundled demo snapshot as the last resort. No key, no account.
import { mergeOpenMeteo } from '../core/weatherMerge.js'
import { FARMS, limaToday, openMeteoUrls } from './farms.js'
import { fetchJSON, isOnline, readJSON, writeJSON } from './storage.js'

const cacheKey = (id) => `chakra.weather.${id}`

export function roundCoord(v) {
  return Math.round(v * 100) / 100
}

async function fetchLive(lat, lon) {
  const today = limaToday()
  const urls = openMeteoUrls(lat, lon, today)
  const [archive, forecast] = await Promise.all([
    fetchJSON(urls.archive).catch(() => null),
    fetchJSON(urls.forecast),
  ])
  return mergeOpenMeteo({ archive, forecast, today, lat, lon, retrievedAt: new Date().toISOString() })
}

/**
 * @param {{id:string, lat:number, lon:number}} place  a demo farm or {id:'gps', lat, lon}
 * @returns {Promise<{data:object|null, origin:'live'|'cache'|'demo'|'none', savedAt?:string}>}
 */
export async function getWeather(place, { preferLive = true } = {}) {
  const lat = roundCoord(place.lat)
  const lon = roundCoord(place.lon)
  if (preferLive && isOnline()) {
    try {
      const data = await fetchLive(lat, lon)
      const savedAt = new Date().toISOString()
      writeJSON(cacheKey(place.id), { data, savedAt })
      return { data, origin: 'live', savedAt }
    } catch {
      // fall through to cache / snapshot
    }
  }
  const cached = readJSON(cacheKey(place.id))
  // Only trust a cache for the same rounded coordinates.
  if (cached?.data && cached.data.lat === lat && cached.data.lon === lon) {
    return { data: cached.data, origin: 'cache', savedAt: cached.savedAt }
  }
  if (FARMS.some((f) => f.id === place.id)) {
    try {
      const data = await fetchJSON(`/data/weather/${place.id}.json`)
      return { data, origin: 'demo', savedAt: data.retrieved_at }
    } catch {
      // no snapshot available
    }
  }
  return { data: null, origin: 'none' }
}

export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('unsupported')); return }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: roundCoord(p.coords.latitude), lon: roundCoord(p.coords.longitude), altitude: Number.isFinite(p.coords.altitude) ? Math.round(p.coords.altitude) : null }),
      reject,
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    )
  })
}
