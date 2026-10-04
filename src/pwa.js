// Service worker registration + "offline ready" state.
import { useEffect, useState } from 'react'
import { readJSON, writeJSON } from './data/storage.js'

const KEY = 'chakra.offlineReady'
let state = readJSON(KEY) ? 'ready' : 'idle'
const listeners = new Set()
const set = (s) => { state = s; listeners.forEach((l) => l(s)) }

export async function registerPWA() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  try {
    const { registerSW } = await import('virtual:pwa-register')
    if (state !== 'ready') set('installing')
    registerSW({
      immediate: true,
      onOfflineReady() { writeJSON(KEY, true); set('ready') },
      onRegisteredSW(_url, reg) {
        // Already controlled by an activated worker -> precache is complete.
        if (reg?.active && navigator.serviceWorker.controller) { writeJSON(KEY, true); set('ready') }
      },
      onRegisterError() { set('idle') },
    })
  } catch {
    set('idle')
  }
}

export function useOfflineReady() {
  const [s, setS] = useState(state)
  useEffect(() => { listeners.add(setS); return () => listeners.delete(setS) }, [])
  return s
}
