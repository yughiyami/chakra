import { Leaf, CloudRain, Coins, ChevronRight, HandHeart } from 'lucide-react'
import { useI18n } from '../i18n/index.jsx'
import { useApp } from '../state/AppState.jsx'
import { leafStatus, priceStatus, weatherStatus } from '../state/status.js'
import { StatusBadge } from '../components/ui.jsx'
import { fmtDate, fmtNum } from '../components/format.js'

function Signal({ icon: Icon, title, status, detail, when, onOpen }) {
  const { t } = useI18n()
  return (
    <li>
      <a href="#" className={`signal signal-${status}`} onClick={(e) => { e.preventDefault(); onOpen() }}>
        <span className="signal-icon"><Icon aria-hidden="true" size={30} strokeWidth={2.2} /></span>
        <span className="signal-body">
          <span className="signal-title">{title}</span>
          <StatusBadge status={status} />
          <span className="signal-detail">{detail}</span>
          {when && <span className="signal-when">{when}</span>}
        </span>
        <ChevronRight className="signal-go" aria-label={t('home.open')} size={26} />
      </a>
    </li>
  )
}

export default function Home({ go }) {
  const { t, lang } = useI18n()
  const { state, weather, place, weatherLoading } = useApp()

  const leaf = state.leaf
  const ls = leafStatus(leaf)
  const leafDetail = !leaf
    ? t('home.leafNone')
    : leaf.result.status === 'answer'
      ? t(`hoja.classes.${leaf.result.label}`)
      : leaf.result.reason === 'ambiguous'
        ? t('hoja.ambiguous', { list: leaf.result.set.map((c) => t(`hoja.classes.${c}`)).join(' / ') })
        : t('app.unsure')

  const ws = weatherLoading && !weather.data ? 'none' : weatherStatus(weather)
  const placeName = place.name ?? t('clima.myLocation')
  const weatherDetail = weatherLoading && !weather.data ? t('app.loading') : weather.status === 'ok' && weather.rust?.status === 'ok'
    ? `${t('clima.rustTitle')}: ${t(`clima.risk.${weather.rust.risk}`)} · ${placeName}`
    : weather.status === 'stale' ? t('clima.staleTitle') : weather.origin === 'none' ? t('clima.noData') : t('clima.insufficient')
  const weatherWhen = weather.newestObserved ? `${weather.demo ? t('clima.demoBanner', { date: fmtDate(weather.data?.today, lang) }) : fmtDate(weather.newestObserved, lang)}` : null

  const price = state.price
  const ps = priceStatus(price)
  const priceDetail = !price
    ? t('home.priceNone')
    : ['below', 'inside', 'above'].includes(price.result.status)
      ? `${t(`precio.verdict.${price.result.status}`)} · S/ ${fmtNum(price.result.offerKg)} ${t('precio.perKg')}`
      : t('app.unsure')

  return (
    <section className="page" aria-labelledby="home-title">
      <h1 id="home-title" className="home-title">{t('home.title')}</h1>
      <p className="home-date">{fmtDate(new Date().toISOString(), lang)}</p>
      <ul className="signals">
        <Signal icon={Leaf} title={t('home.leaf')} status={ls} detail={leafDetail} when={leaf ? fmtDate(leaf.at, lang) : null} onOpen={() => go('hoja')} />
        <Signal icon={CloudRain} title={t('home.weather')} status={ws} detail={weatherDetail} when={weatherWhen} onOpen={() => go('clima')} />
        <Signal icon={Coins} title={t('home.price')} status={ps} detail={priceDetail} when={price ? fmtDate(price.at, lang) : null} onOpen={() => go('precio')} />
      </ul>
      <p className="decide-note"><HandHeart aria-hidden="true" size={22} /> {t('home.decide')}</p>
    </section>
  )
}
