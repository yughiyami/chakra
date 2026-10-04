import { useCallback, useEffect, useState } from 'react'
import { I18nProvider } from './i18n/index.jsx'
import { AppStateProvider, useApp } from './state/AppState.jsx'
import { Header, BottomNav, TABS } from './components/Shell.jsx'
import { useOfflineReady } from './pwa.js'
import Home from './pages/Home.jsx'
import Hoja from './pages/Hoja.jsx'
import Clima from './pages/Clima.jsx'
import Precio from './pages/Precio.jsx'
import Tarjeta from './pages/Tarjeta.jsx'
import Acerca from './pages/Acerca.jsx'

const PAGES = { home: Home, hoja: Hoja, clima: Clima, precio: Precio, tarjeta: Tarjeta, acerca: Acerca }

function routeFromHash() {
  const id = window.location.hash.replace(/^#\/?/, '')
  return TABS.some((t) => t.id === id) ? id : 'home'
}

function Shell() {
  const [route, setRoute] = useState(routeFromHash)
  const { online } = useApp()
  const offlineState = useOfflineReady()

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((id) => {
    window.location.hash = id === 'home' ? '/' : `/${id}`
    window.scrollTo(0, 0)
  }, [])

  const Page = PAGES[route]
  return (
    <div className="app">
      <Header route={route} go={go} offlineState={offlineState} online={online} />
      <main id="main" className="main">
        <Page go={go} />
      </main>
      <BottomNav route={route} go={go} />
    </div>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <AppStateProvider>
        <Shell />
      </AppStateProvider>
    </I18nProvider>
  )
}
