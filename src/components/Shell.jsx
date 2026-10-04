import { Leaf, CloudRain, Coins, MessageSquareText, Info, CircleCheck, WifiOff, LoaderCircle } from 'lucide-react'
import { useI18n } from '../i18n/index.jsx'

export const TABS = [
  { id: 'hoja', icon: Leaf },
  { id: 'clima', icon: CloudRain },
  { id: 'precio', icon: Coins },
  { id: 'tarjeta', icon: MessageSquareText },
  { id: 'acerca', icon: Info },
]

function LeafMark() {
  return (
    <svg viewBox="0 0 512 512" width="34" height="34" aria-hidden="true">
      <rect width="512" height="512" rx="112" fill="var(--leaf)" />
      <g transform="translate(256 262) rotate(-35)">
        <path d="M0 -150 C 92 -104 104 40 0 150 C -104 40 -92 -104 0 -150 Z" fill="var(--paper)" />
        <path d="M0 -128 L0 132" stroke="var(--leaf)" strokeWidth="14" strokeLinecap="round" />
      </g>
      <circle cx="352" cy="352" r="46" fill="var(--cherry)" stroke="var(--paper)" strokeWidth="12" />
    </svg>
  )
}

export function Header({ route, go, offlineState, online }) {
  const { t, lang, setLang } = useI18n()
  return (
    <header className="header">
      <div className="header-row">
        <a href="#/" className="brand" aria-label={t('app.home')} aria-current={route === 'home' ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go('home') }}>
          <LeafMark />
          <span className="brand-name">Chakra</span>
        </a>
        <div className="lang" role="group" aria-label={t('app.lang')}>
          <button type="button" className={lang === 'es' ? 'on' : ''} aria-pressed={lang === 'es'} onClick={() => setLang('es')} lang="es">ES</button>
          <button type="button" className={lang === 'quy' ? 'on' : ''} aria-pressed={lang === 'quy'} onClick={() => setLang('quy')} lang="quy">QU</button>
        </div>
      </div>
      <div className="header-sub">
        <p className="tagline">{t('app.tagline')}</p>
        {!online ? (
          <span className="net net-off"><WifiOff size={15} aria-hidden="true" /> {t('app.offline')}</span>
        ) : offlineState === 'ready' ? (
          <span className="net net-ready"><CircleCheck size={15} aria-hidden="true" /> {t('app.offlineReady')}</span>
        ) : offlineState === 'installing' ? (
          <span className="net"><LoaderCircle size={15} className="spin" aria-hidden="true" /> {t('app.offlinePreparing')}</span>
        ) : null}
      </div>
    </header>
  )
}

export function BottomNav({ route, go }) {
  const { t } = useI18n()
  return (
    <nav className="tabs" aria-label="Chakra">
      {TABS.map(({ id, icon: Icon }) => (
        <a
          key={id}
          href={`#/${id}`}
          className={`tab ${route === id ? 'on' : ''}`}
          aria-current={route === id ? 'page' : undefined}
          onClick={(e) => { e.preventDefault(); go(id) }}
        >
          <span className="tab-icon"><Icon aria-hidden="true" size={24} strokeWidth={route === id ? 2.6 : 2} /></span>
          <span className="tab-label">{t(`nav.${id}`)}</span>
        </a>
      ))}
    </nav>
  )
}
