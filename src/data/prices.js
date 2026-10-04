// Price reference data: bundled prices.json + optional live USD->PEN rate.
import { fetchJSON, isOnline, readJSON, writeJSON } from './storage.js'

const FX_KEY = 'chakra.fx'

export async function loadPrices() {
  try {
    return await fetchJSON('/data/prices.json')
  } catch {
    return null
  }
}

/** Returns {rate, asOf, source} from open.er-api.com (or its cache), else null. */
export async function loadLiveFx() {
  if (isOnline()) {
    try {
      const r = await fetchJSON('https://open.er-api.com/v6/latest/USD', { timeoutMs: 8000 })
      const rate = r?.rates?.PEN
      if (r?.result === 'success' && Number.isFinite(rate)) {
        const asOf = r.time_last_update_unix
          ? new Date(r.time_last_update_unix * 1000).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10)
        const fx = { rate, asOf, source: 'open.er-api.com' }
        writeJSON(FX_KEY, fx)
        return fx
      }
    } catch {
      // offline or blocked -> cached / bundled
    }
  }
  return readJSON(FX_KEY)
}
