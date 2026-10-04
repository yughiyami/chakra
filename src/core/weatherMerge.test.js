import { describe, it, expect } from 'vitest'
import { mergeOpenMeteo } from './weatherMerge.js'

const daily = (time, tmax, rain) => ({
  time,
  temperature_2m_max: tmax,
  temperature_2m_min: tmax.map((t) => (t == null ? null : t - 10)),
  temperature_2m_mean: tmax.map((t) => (t == null ? null : t - 5)),
  precipitation_sum: rain,
  relative_humidity_2m_mean: rain.map(() => 80),
})

describe('mergeOpenMeteo', () => {
  const archive = { elevation: 1480, daily: daily(['2026-10-01', '2026-10-02', '2026-10-03'], [25, null, null], [1, null, null]) }
  const forecast = { elevation: 1500, daily: daily(['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'], [26, 27, 28, 29], [2, 3, 4, 5]) }

  it('prefers archive values and fills gaps from the forecast endpoint', () => {
    const m = mergeOpenMeteo({ archive, forecast, today: '2026-10-04', lat: -10.73, lon: -75.27, retrievedAt: '2026-10-04T12:00:00Z' })
    expect(m.days.map((d) => d.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'])
    expect(m.days[0]).toEqual({ date: '2026-10-01', tmax: 25, tmin: 15, tmean: 20, rain: 1, rh: 80 })
    expect(m.days[1].tmax).toBe(26)
    expect(m.elevation).toBe(1480)
    expect(m.today).toBe('2026-10-04')
    expect(m.retrieved_at).toBe('2026-10-04T12:00:00Z')
    expect(m.lat).toBe(-10.73)
  })

  it('works with forecast only', () => {
    const m = mergeOpenMeteo({ forecast, today: '2026-10-04' })
    expect(m.days).toHaveLength(4)
    expect(m.elevation).toBe(1500)
  })
})
