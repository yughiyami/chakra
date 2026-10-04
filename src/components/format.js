// Display formatting helpers (Peru locale).
export function fmtDate(iso, lang = 'es') {
  if (!iso) return '—'
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`)
  try {
    return d.toLocaleDateString(lang === 'quy' ? 'es-PE' : 'es-PE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  } catch {
    return iso.slice(0, 10)
  }
}

export function fmtNum(v, digits = 1) {
  if (!Number.isFinite(v)) return '—'
  return v.toLocaleString('es-PE', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export const pct = (v) => (Number.isFinite(v) ? String(Math.round(v * 100)) : '—')
