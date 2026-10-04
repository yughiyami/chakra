// Fetch 90 days of history + 16 days of forecast from Open-Meteo (CC BY 4.0, no key)
// for the demo farms and write offline snapshots to public/data/weather/<id>.json.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FARMS, limaToday, openMeteoUrls } from '../src/data/farms.js'
import { mergeOpenMeteo } from '../src/core/weatherMerge.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'data', 'weather')
mkdirSync(outDir, { recursive: true })

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

const today = limaToday()
for (const farm of FARMS) {
  const urls = openMeteoUrls(farm.lat, farm.lon, today)
  const [archive, forecast] = await Promise.all([getJson(urls.archive), getJson(urls.forecast)])
  const merged = mergeOpenMeteo({
    archive, forecast, today, lat: farm.lat, lon: farm.lon, retrievedAt: new Date().toISOString(),
  })
  const snapshot = { id: farm.id, name: farm.name, demo: true, ...merged }
  writeFileSync(join(outDir, `${farm.id}.json`), JSON.stringify(snapshot) + '\n')
  const observed = merged.days.filter((d) => d.date < today && d.tmax != null)
  console.log(`${farm.id}: ${merged.days.length} days, grid elevation ${merged.elevation} m, newest observed ${observed.at(-1)?.date}`)
}
