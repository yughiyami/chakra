import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { assessWeather } from '../core/rules.js'
import { referenceBand } from '../core/price.js'
import { FARMS, limaToday } from '../data/farms.js'
import { getWeather } from '../data/weather.js'
import { loadLiveFx, loadPrices } from '../data/prices.js'
import { readJSON, writeJSON } from '../data/storage.js'

const KEY = 'chakra.state.v1'

const DEFAULTS = {
  placeId: FARMS[0].id,
  gps: null, // {lat, lon, altitude} rounded, local only
  altitude: FARMS[0].altitude,
  shade: false,
  brocaStart: null,
  leaf: null, // {result, at}
  price: null, // {result, offer, unit, at}
  outbox: [],
}

const AppContext = createContext(null)

export function AppStateProvider({ children }) {
  const [state, setState] = useState(() => ({ ...DEFAULTS, ...(readJSON(KEY) ?? {}) }))
  const [weatherRaw, setWeatherRaw] = useState({ loading: true, data: null, origin: 'none' })
  const [prices, setPrices] = useState(null)
  const [fx, setFx] = useState(null)
  const [online, setOnline] = useState(() => navigator.onLine !== false)

  useEffect(() => { writeJSON(KEY, state) }, [state])
  const update = useCallback((patch) => setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })), [])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const place = useMemo(() => {
    if (state.placeId === 'gps' && state.gps) return { id: 'gps', code: 'GPS', name: null, lat: state.gps.lat, lon: state.gps.lon }
    return FARMS.find((f) => f.id === state.placeId) ?? FARMS[0]
  }, [state.placeId, state.gps])

  const refreshWeather = useCallback(async () => {
    setWeatherRaw((w) => ({ ...w, loading: true }))
    const r = await getWeather(place)
    setWeatherRaw({ loading: false, ...r })
  }, [place])

  useEffect(() => { refreshWeather() }, [refreshWeather, online])

  useEffect(() => {
    loadPrices().then(setPrices)
  }, [])
  useEffect(() => {
    loadLiveFx().then(setFx)
  }, [online])

  const weather = useMemo(() => {
    const d = weatherRaw.data
    if (!d) return { status: 'insufficient', reason: 'no_data', origin: weatherRaw.origin }
    const assessment = assessWeather({
      days: d.days,
      today: d.today,
      now: limaToday(),
      farmAltitude: Number.isFinite(state.altitude) ? state.altitude : null,
      gridElevation: d.elevation,
      shade: state.shade,
      brocaStart: state.brocaStart,
      demo: weatherRaw.origin === 'demo',
    })
    return { ...assessment, origin: weatherRaw.origin, savedAt: weatherRaw.savedAt, data: d }
  }, [weatherRaw, state.altitude, state.shade, state.brocaStart])

  const band = useMemo(() => referenceBand(prices, fx), [prices, fx])

  const value = useMemo(() => ({
    state, update, place, weather, weatherLoading: weatherRaw.loading, refreshWeather, prices, band, fx, online,
  }), [state, update, place, weather, weatherRaw.loading, refreshWeather, prices, band, fx, online])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  return useContext(AppContext)
}
