import { useState } from 'react'
import { Coins, Scale, Calculator, TriangleAlert, Landmark } from 'lucide-react'
import { useI18n } from '../i18n/index.jsx'
import { useApp } from '../state/AppState.jsx'
import { assessOffer } from '../core/price.js'
import { limaToday } from '../data/farms.js'
import { priceStatus } from '../state/status.js'
import { PageTitle, SpeakButton, StatusBadge, Unsure, Source } from '../components/ui.jsx'
import { fmtDate, fmtNum } from '../components/format.js'

export default function Precio() {
  const { t, tEs, lang } = useI18n()
  const { band, state, update } = useApp()
  const [offer, setOffer] = useState(state.price?.offer ?? '')
  const [unit, setUnit] = useState(state.price?.unit ?? 'kg')
  const result = state.price?.result ?? null

  function check(e) {
    e.preventDefault()
    const value = Number(String(offer).replace(',', '.'))
    const r = assessOffer({ offer: value, unit, band, now: limaToday() })
    const stored = { ...r, band: band.status === 'ok' ? { lowKg: band.lowKg, highKg: band.highKg } : null }
    update({ price: { result: stored, offer, unit, at: new Date().toISOString() } })
  }

  const ok = band.status === 'ok'
  const known = result && ['below', 'inside', 'above'].includes(result.status)

  return (
    <section className="page" aria-labelledby="precio-title">
      <PageTitle icon={Coins}><span id="precio-title">{t('precio.title')}</span></PageTitle>

      {ok ? (
        <div className="panel band">
          <h2 className="panel-title"><Scale aria-hidden="true" size={22} /> {t('precio.reference')}</h2>
          <div className="band-row">
            <p><span className="band-num">S/ {fmtNum(band.lowKg)} – {fmtNum(band.highKg)}</span><span className="band-unit">{t('precio.perKg')}</span></p>
            <p><span className="band-num band-num-2">S/ {fmtNum(band.lowQq, 0)} – {fmtNum(band.highQq, 0)}</span><span className="band-unit">{t('precio.perQq', { kg: band.quintalKg })}</span></p>
          </div>
          <p className="fine">{t('precio.disclaimer')} {t('precio.quality')}</p>
        </div>
      ) : (
        <Unsure reason={t('precio.unknown.no_reference')} />
      )}

      <form className="panel offer" onSubmit={check}>
        <label className="field">
          <span className="label">{t('precio.offer')}</span>
          <input type="text" inputMode="decimal" autoComplete="off" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="0.00" />
        </label>
        <div className="segmented" role="group" aria-label={t('precio.offer')}>
          <button type="button" className={unit === 'kg' ? 'on' : ''} aria-pressed={unit === 'kg'} onClick={() => setUnit('kg')}>{t('precio.unitKg')}</button>
          <button type="button" className={unit === 'qq' ? 'on' : ''} aria-pressed={unit === 'qq'} onClick={() => setUnit('qq')}>{t('precio.unitQq')}</button>
        </div>
        <button type="submit" className="btn btn-primary btn-xl"><Calculator aria-hidden="true" size={24} /> {t('precio.check')}</button>
      </form>

      <div aria-live="polite">
        {result && known && (
          <article className="panel result reveal">
            <p className={`verdict verdict-price-${result.status}`}>{t(`precio.verdict.${result.status}`)}</p>
            <StatusBadge status={priceStatus({ result })} size="lg" />
            <p className="body">S/ {fmtNum(result.offerKg, 2)} {t('precio.perKg')}</p>
            <p className="body strong">{t(`precio.${result.status}`)}</p>
            {result.oldReference && <p className="alert-line"><TriangleAlert aria-hidden="true" size={20} /> {t('precio.oldReference', { months: result.ageMonths })}</p>}
            {result.status === 'below' && <p className="action"><Landmark aria-hidden="true" size={20} /> Junta Nacional del Café</p>}
            <SpeakButton text={`${tEs(`precio.${result.status}`)} ${tEs('precio.disclaimer')} ${tEs('precio.quality')}`} />
          </article>
        )}
        {result && !known && (
          <Unsure reason={t(`precio.unknown.${result.reason}`)}>
            <SpeakButton text={`${tEs('app.unsure')}. ${tEs(`precio.unknown.${result.reason}`)}`} />
          </Unsure>
        )}
      </div>

      {ok && (
        <section className="panel">
          <h2 className="panel-title">{t('precio.howTitle')}</h2>
          <p className="body">{t('precio.how', { usd: fmtNum(band.intl.usdKg, 2), month: band.intl.month, fx: fmtNum(band.fx.rate, 2), lo: band.passThrough[0], hi: band.passThrough[1] })}</p>
          <Source>{t('precio.intlSource', { month: band.intl.month })}</Source>
          <Source>{t('precio.fxSource', { source: band.fx.source === 'open.er-api.com' ? t('precio.fxLive') : t('precio.fxBundled'), date: band.fx.source === 'open.er-api.com' ? fmtDate(band.fx.asOf, lang) : band.fx.asOf })}</Source>
          <Source>{t('precio.ptSource')}</Source>
        </section>
      )}
    </section>
  )
}
