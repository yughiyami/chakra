import { useMemo, useState } from 'react'
import { MessageSquareText, MessageCircle, Smartphone, Copy, Check, Inbox, Trash2, Save, CircleCheck, ChevronDown } from 'lucide-react'
import { useI18n } from '../i18n/index.jsx'
import { useApp } from '../state/AppState.jsx'
import { addToOutbox, buildCard, shareLinks } from '../core/card.js'
import { limaToday } from '../data/farms.js'
import { PageTitle } from '../components/ui.jsx'

export default function Tarjeta() {
  const { t } = useI18n()
  const { state, update, weather, place } = useApp()
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  const code = useMemo(() => buildCard({
    date: limaToday(),
    farm: place.code,
    leaf: state.leaf?.result ?? null,
    weather: weather.origin === 'none' ? null : weather,
    price: state.price?.result ?? null,
  }), [state.leaf, state.price, weather, place.code])

  const links = shareLinks(code)
  const save = () => {
    update((s) => ({ outbox: addToOutbox(s.outbox ?? [], code, new Date().toISOString()) }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }
  const markSent = (id) => update((s) => ({ outbox: s.outbox.map((o) => (o.id === id ? { ...o, sent: true, sentAt: new Date().toISOString() } : o)) }))
  const remove = (id) => update((s) => ({ outbox: s.outbox.filter((o) => o.id !== id) }))
  const when = (iso) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <section className="page" aria-labelledby="tarjeta-title">
      <PageTitle icon={MessageSquareText}><span id="tarjeta-title">{t('tarjeta.title')}</span></PageTitle>
      <p className="lead">{t('tarjeta.intro')}</p>

      <div className="panel card-code">
        <p className="label">{t('tarjeta.code')}</p>
        <output className="code" aria-live="polite">{code}</output>
        <p className="fine">{t('tarjeta.chars', { n: code.length })} · {t('tarjeta.nothingSent')}</p>
        <div className="share">
          <a className="btn btn-primary" href={links.whatsapp} target="_blank" rel="noopener noreferrer" onClick={save}>
            <MessageCircle aria-hidden="true" size={24} /> {t('tarjeta.whatsapp')}
          </a>
          <a className="btn btn-secondary" href={links.sms} onClick={save}>
            <Smartphone aria-hidden="true" size={24} /> {t('tarjeta.sms')}
          </a>
          <button type="button" className="btn btn-secondary" onClick={copy}>
            {copied ? <Check aria-hidden="true" size={24} /> : <Copy aria-hidden="true" size={24} />} {copied ? t('tarjeta.copied') : t('tarjeta.copy')}
          </button>
          <button type="button" className="btn btn-quiet" onClick={save}>
            {saved ? <CircleCheck aria-hidden="true" size={22} /> : <Save aria-hidden="true" size={22} />} {saved ? t('tarjeta.saved') : t('tarjeta.save')}
          </button>
        </div>
        <span className="sr-only" aria-live="polite">{copied ? t('tarjeta.copied') : saved ? t('tarjeta.saved') : ''}</span>
      </div>

      <details className="panel legend">
        <summary className="panel-title"><ChevronDown className="legend-chev" aria-hidden="true" size={22} /> {t('tarjeta.legendTitle')}</summary>
        <ul>{t('tarjeta.legend').map((l) => <li key={l}>{l}</li>)}</ul>
      </details>

      <section className="panel" aria-labelledby="outbox-title">
        <h2 id="outbox-title" className="panel-title"><Inbox aria-hidden="true" size={22} /> {t('tarjeta.outbox')}</h2>
        <p className="fine">{t('tarjeta.outboxNote')}</p>
        {!state.outbox?.length && <p className="muted">{t('tarjeta.outboxEmpty')}</p>}
        <ul className="outbox">
          {(state.outbox ?? []).map((o) => (
            <li key={o.id} className={o.sent ? 'sent' : ''}>
              <p className="outbox-when">{when(o.createdAt)}{o.sent ? ` · ${t('tarjeta.sent')}` : ''}</p>
              <p className="code code-sm">{o.text}</p>
              <div className="outbox-actions">
                {!o.sent && (
                  <a className="btn btn-small" href={shareLinks(o.text).whatsapp} target="_blank" rel="noopener noreferrer">
                    <MessageCircle aria-hidden="true" size={18} /> {t('tarjeta.whatsapp')}
                  </a>
                )}
                {!o.sent && (
                  <button type="button" className="btn btn-small" onClick={() => markSent(o.id)}>
                    <Check aria-hidden="true" size={18} /> {t('tarjeta.markSent')}
                  </button>
                )}
                <button type="button" className="btn btn-small btn-ghost" onClick={() => remove(o.id)} aria-label={`${t('tarjeta.remove')} ${when(o.createdAt)}`}>
                  <Trash2 aria-hidden="true" size={18} /> {t('tarjeta.remove')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </section>
  )
}
