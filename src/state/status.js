// Map module results to the shared status vocabulary (ok / warn / alert / unknown / none).
export function leafStatus(leaf) {
  const r = leaf?.result
  if (!r) return 'none'
  if (r.status !== 'answer') return 'unknown'
  if (r.label === 'healthy') return 'ok'
  return r.label === 'rust' ? 'alert' : 'warn'
}

export function weatherStatus(w) {
  if (!w || w.status !== 'ok' || w.rust?.status !== 'ok') return w?.origin === 'none' ? 'none' : 'unknown'
  return { high: 'alert', medium: 'warn', low: 'ok' }[w.rust.risk] ?? 'unknown'
}

export function priceStatus(p) {
  const r = p?.result
  if (!r) return 'none'
  return { below: 'alert', inside: 'ok', above: 'ok' }[r.status] ?? 'unknown'
}
