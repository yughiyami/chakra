import { useState } from 'react'
import { CloudRain, MapPin, Mountain, Sun, TreeDeciduous, Bug, Timer, Thermometer, CalendarDays, Info, LoaderCircle, Droplets } from 'lucide-react'
import { useI18n } from '../i18n/index.jsx'
import { useApp } from '../state/AppState.jsx'
import { FARMS } from '../data/farms.js'
import { getPosition } from '../data/weather.js'
import { addDays } from '../core/rules.js'
import { weatherStatus } from '../state/status.js'
import { PageTitle, SpeakButton, StatusBadge, Unsure, Source } from '../components/ui.jsx'
import { fmtDate, fmtNum } from '../components/format.js'
import { WeatherChart } from '../components/WeatherChart.jsx'

function Controls() {
  const { t } = useI18n()
  const { state, update, weather } = useApp()
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState(false)

  async function useMyLocation() {
    setLocating(true)
    setLocError(false)
    try {
      const gps = await getPosition()
      update({ placeId: 'gps', gps, altitude: gps.altitude ?? state.altitude })
    } catch {
      setLocError(true)
    } finally {
      setLocating(false)
    }
  }

  const elev = weather.data?.elevation
  const newest = weather.newestObserved
  return (
    <div className="panel controls">
      <fieldset className="field">
        <legend className="label"><MapPin aria-hidden="true" size={20} /> {t('clima.farm')}</legend>
        <div className="chips">
          {FARMS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip ${state.placeId === f.id ? 'on' : ''}`}
              aria-pressed={state.placeId === f.id}
              onClick={() => update({ placeId: f.id, altitude: f.altitude })}
            >
              {f.name}<small>{f.region}</small>
            </button>
          ))}
          <button type="button" className={`chip ${state.placeId === 'gps' ? 'on' : ''}`} aria-pressed={state.placeId === 'gps'} onClick={useMyLocation} disabled={locating}>
            {locating ? <LoaderCircle className="spin" size={18} aria-hidden="true" /> : <MapPin size={18} aria-hidden="true" />} {t('clima.myLocation')}
          </button>
        </div>
        {locating && <p className="muted">{t('clima.locating')}</p>}
        {locError && <p className="error">{t('clima.locationError')}</p>}
        <p className="fine">{t('clima.locationPrivacy')}</p>
      </fieldset>

      <label className="field">
        <span className="label"><Mountain aria-hidden="true" size={20} /> {t('clima.altitude')}</span>
        <input
          type="number" inputMode="numeric" min="0" max="4000" step="10"
          value={Number.isFinite(state.altitude) ? state.altitude : ''}
          onChange={(e) => update({ altitude: e.target.value === '' ? null : Number(e.target.value) })}
        />
        {Number.isFinite(elev) && (
          <span className="fine">{t('clima.altitudeNote', { elev: Math.round(elev), delta: fmtNum(weather.altitudeDelta ?? 0) })}</span>
        )}
      </label>

      <fieldset className="field">
        <legend className="label">{t('clima.shade')}</legend>
        <div className="segmented">
          <button type="button" className={!state.shade ? 'on' : ''} aria-pressed={!state.shade} onClick={() => update({ shade: false })}>
            <Sun aria-hidden="true" size={22} /> {t('clima.sun')}
          </button>
          <button type="button" className={state.shade ? 'on' : ''} aria-pressed={state.shade} onClick={() => update({ shade: true })}>
            <TreeDeciduous aria-hidden="true" size={22} /> {t('clima.shadeOpt')}
          </button>
        </div>
      </fieldset>

      <label className="field">
        <span className="label"><CalendarDays aria-hidden="true" size={20} /> {t('clima.brocaStart')}</span>
        <input
          type="date"
          value={state.brocaStart ?? (newest ? addDays(newest, -60) : '')}
          max={newest ?? undefined}
          onChange={(e) => update({ brocaStart: e.target.value || null })}
        />
      </label>
    </div>
  )
}

function Banner() {
  const { t, lang } = useI18n()
  const { weather } = useApp()
  if (weather.origin === 'demo') return <p className="banner banner-demo" role="note"><Info aria-hidden="true" size={20} /> {t('clima.demoBanner', { date: fmtDate(weather.data?.today, lang) })}</p>
  if (weather.origin === 'cache') return <p className="banner" role="note"><Info aria-hidden="true" size={20} /> {t('clima.cacheBanner', { date: fmtDate(weather.savedAt, lang) })}</p>
  if (weather.origin === 'live') return <p className="banner banner-live" role="note">{t('clima.liveBanner', { date: fmtDate(weather.savedAt, lang) })}</p>
  return null
}

function RustCard() {
  const { t, tEs } = useI18n()
  const { weather } = useApp()
  const r = weather.rust
  if (r?.status !== 'ok') return <Unsure reason={t('clima.insufficient')} />
  const speech = `${tEs('clima.rustTitle')}: ${tEs(`clima.risk.${r.risk}`)}. ${tEs(`clima.rustAdvice.${r.risk}`)}`
  return (
    <article className="panel result reveal">
      <h2 className="panel-title"><Droplets aria-hidden="true" size={22} /> {t('clima.rustTitle')}</h2>
      <p className={`verdict verdict-${r.risk}`}>{t(`clima.risk.${r.risk}`)}</p>
      <StatusBadge status={weatherStatus(weather)} size="lg" />
      <p className="body">{t(`clima.rustAdvice.${r.risk}`)}</p>
      <ul className="facts">
        <li><span>{t('clima.infection', { days: r.infection.days })}</span><b>{t(`clima.level.${r.infection.level}`)}</b></li>
        <li><span>{t('clima.latency', { days: r.latency.days })}</span><b>{t(`clima.level.${r.latency.level}`)}</b></li>
        <li><span>{t('clima.washoff', { days: r.washoff.days })}</span><b>{t(`clima.level.${r.washoff.level}`)}</b></li>
      </ul>
      <SpeakButton text={speech} />
      <Source>{t('clima.rustMethod')}</Source>
    </article>
  )
}

function IncubationCard() {
  const { t, tEs } = useI18n()
  const { weather } = useApp()
  const inc = weather.incubation
  if (inc?.status !== 'ok') return null
  return (
    <article className="panel reveal">
      <h2 className="panel-title"><Timer aria-hidden="true" size={22} /> {t('clima.incubationTitle')}</h2>
      <p className="big-number">{inc.days} <small>d</small></p>
      <p className="body">{t('clima.incubationBody', { days: inc.days })}</p>
      {inc.severe && <p className="alert-line"><StatusBadge status="alert" /> {t('clima.incubationSevere')}</p>}
      <SpeakButton text={`${tEs('clima.incubationBody', { days: inc.days })} ${inc.severe ? tEs('clima.incubationSevere') : ''}`} />
      <Source>{t('clima.incubationMethod', { tx: fmtNum(inc.tx), tn: fmtNum(inc.tn) })}</Source>
    </article>
  )
}

function DiurnalCard() {
  const { t } = useI18n()
  const { weather } = useApp()
  const d = weather.diurnal
  if (d?.status !== 'ok') return null
  return (
    <article className="panel reveal">
      <h2 className="panel-title"><Thermometer aria-hidden="true" size={22} /> {t('clima.diurnalTitle')}</h2>
      <StatusBadge status={d.flag ? 'warn' : 'ok'} />
      <p className="body">
        {d.flag
          ? t('clima.diurnalFlag', { drop: fmtNum(d.drop) })
          : t('clima.diurnalOk', { recent: fmtNum(d.recent), baseline: fmtNum(d.baseline) })}
      </p>
      <Source>{t('clima.diurnalMethod')}</Source>
    </article>
  )
}

function BrocaCard() {
  const { t, tEs, lang } = useI18n()
  const { weather } = useApp()
  const b = weather.broca
  if (b?.status !== 'ok') return <Unsure reason={t('clima.brocaUnknown')} />
  const progress = Math.min(1, b.dd / b.target)
  const vars = { dd: Math.round(b.dd), target: b.target, start: fmtDate(b.startDate, lang), date: fmtDate(b.projectedDate, lang) }
  const line = b.reached ? 'clima.brocaReached' : b.projectedDate ? 'clima.brocaProjected' : 'clima.brocaNotYet'
  return (
    <article className="panel reveal">
      <h2 className="panel-title"><Bug aria-hidden="true" size={22} /> {t('clima.brocaTitle')}</h2>
      <p className="body">{t('clima.brocaBody', vars)}</p>
      <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={b.target} aria-valuenow={Math.round(b.dd)} aria-label={t('clima.brocaTitle')}>
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <p className="body strong">{t(line, vars)}</p>
      <p className="action">{t('clima.brocaAction')}</p>
      <SpeakButton text={`${tEs('clima.brocaBody', vars)} ${tEs(line, vars)} ${tEs('clima.brocaAction')}`} />
      <Source>{t('clima.brocaMethod')}</Source>
    </article>
  )
}

export default function Clima() {
  const { t, lang } = useI18n()
  const { weather, weatherLoading } = useApp()
  const d = weather.data

  let body
  if (weatherLoading && !d) {
    body = <p className="busy"><LoaderCircle className="spin" size={22} aria-hidden="true" /> {t('app.loading')}</p>
  } else if (weather.status === 'stale') {
    body = <Unsure title={t('clima.staleTitle')} reason={t('clima.staleBody', { date: fmtDate(weather.newestObserved, lang), days: weather.ageDays })} />
  } else if (weather.status !== 'ok') {
    body = <Unsure reason={weather.reason === 'no_data' ? t('clima.noData') : t('clima.insufficient')} />
  } else {
    body = (
      <>
        <Banner />
        <RustCard />
        <IncubationCard />
        <DiurnalCard />
        <BrocaCard />
        <section className="panel">
          <h2 className="panel-title"><CloudRain aria-hidden="true" size={22} /> {t('clima.chartTitle')}</h2>
          <WeatherChart days={d.days} today={d.today} label={t('clima.chartLegend')} />
          <p className="fine">{t('clima.chartLegend')}</p>
          <Source>{t('clima.source', { start: fmtDate(weather.observedRange?.[0], lang), end: fmtDate(d.days.at(-1)?.date, lang), retrieved: fmtDate(d.retrieved_at, lang) })}</Source>
        </section>
      </>
    )
  }

  return (
    <section className="page" aria-labelledby="clima-title">
      <PageTitle icon={CloudRain}><span id="clima-title">{t('clima.title')}</span></PageTitle>
      <Controls />
      <div aria-live="polite">{body}</div>
    </section>
  )
}
