// Demo farms (approximate town coordinates and typical coffee altitudes).
export const FARMS = [
  { id: 'villa-rica', code: 'VRICA', name: 'Villa Rica', region: 'Pasco', lat: -10.73, lon: -75.27, altitude: 1500 },
  { id: 'quillabamba', code: 'QUILLA', name: 'Quillabamba', region: 'Cusco', lat: -12.86, lon: -72.69, altitude: 1050 },
  { id: 'jaen', code: 'JAEN', name: 'Jaén', region: 'Cajamarca', lat: -5.71, lon: -78.81, altitude: 1300 },
  { id: 'saposoa', code: 'SAPOSOA', name: 'Saposoa', region: 'San Martín', lat: -6.93, lon: -76.77, altitude: 1200 },
]

export const DAILY_VARS = 'temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean'

/** Today's date in Peru (America/Lima, UTC-5, no DST). */
export function limaToday(now = new Date()) {
  return new Date(now.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10)
}

function shift(date, n) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
}

export function openMeteoUrls(lat, lon, today) {
  const q = `latitude=${lat}&longitude=${lon}&daily=${DAILY_VARS}&timezone=America%2FLima`
  return {
    archive: `https://archive-api.open-meteo.com/v1/archive?${q}&start_date=${shift(today, -90)}&end_date=${shift(today, -1)}`,
    // past_days fills the ~5 day ERA5 archive lag with recent model analysis.
    forecast: `https://api.open-meteo.com/v1/forecast?${q}&past_days=7&forecast_days=16`,
  }
}
