// localStorage wrapper that never throws (private mode, quota, disabled storage).
export function readJSON(key, fallback = null) {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeJSON(key, value) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** Fetch JSON, rejecting HTML fallbacks (SPA rewrites return index.html for missing files). */
export async function fetchJSON(url, { text = false, timeoutMs = 15000 } = {}) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  try {
    const res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const type = res.headers.get('content-type') || ''
    if (type.includes('text/html')) throw new Error('not found')
    return text ? await res.text() : await res.json()
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export const isOnline = () => (typeof navigator === 'undefined' ? false : navigator.onLine !== false)
