// Plain-SVG rain bars + mean temperature line. No chart library.
export function WeatherChart({ days, today, label }) {
  const valid = days.filter((d) => d.date && (Number.isFinite(d.rain) || Number.isFinite(d.tmean)))
  if (valid.length < 2) return null
  const W = 320
  const H = 120
  const pad = { t: 8, b: 18, l: 4, r: 4 }
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const n = valid.length
  const bw = iw / n
  const maxRain = Math.max(10, ...valid.map((d) => d.rain ?? 0))
  const temps = valid.map((d) => d.tmean ?? (Number.isFinite(d.tmax) ? (d.tmax + d.tmin) / 2 : null)).filter(Number.isFinite)
  const tMin = Math.floor(Math.min(...temps) - 1)
  const tMax = Math.ceil(Math.max(...temps) + 1)
  const x = (i) => pad.l + i * bw
  const yT = (v) => pad.t + ih - ((v - tMin) / (tMax - tMin)) * ih
  const firstForecast = valid.findIndex((d) => d.date >= today)

  let path = ''
  valid.forEach((d, i) => {
    const v = d.tmean ?? (Number.isFinite(d.tmax) ? (d.tmax + d.tmin) / 2 : null)
    if (!Number.isFinite(v)) return
    path += `${path ? 'L' : 'M'}${(x(i) + bw / 2).toFixed(1)},${yT(v).toFixed(1)}`
  })

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="none">
        {firstForecast > 0 && (
          <rect x={x(firstForecast)} y={pad.t} width={W - pad.r - x(firstForecast)} height={ih} fill="var(--forecast)" />
        )}
        {valid.map((d, i) => {
          const h = ((d.rain ?? 0) / maxRain) * ih
          return <rect key={d.date} x={x(i) + 0.4} y={pad.t + ih - h} width={Math.max(0.6, bw - 0.8)} height={h} fill="var(--rain)" />
        })}
        <path d={path} fill="none" stroke="var(--cherry)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + ih} y2={pad.t + ih} stroke="var(--line-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="chart-axis">
        <span>{valid[0].date.slice(5)}</span>
        <span>{tMin}–{tMax} °C · {Math.round(maxRain)} mm</span>
        <span>{valid[n - 1].date.slice(5)}</span>
      </div>
    </figure>
  )
}
