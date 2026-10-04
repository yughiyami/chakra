import { useEffect, useState } from 'react'
import {
  CheckCircle2, TriangleAlert, OctagonAlert, CircleHelp, CircleDashed,
  Volume2, Square, BookOpen, UserRound,
} from 'lucide-react'
import { useI18n } from '../i18n/index.jsx'

const STATUS_ICON = { ok: CheckCircle2, warn: TriangleAlert, alert: OctagonAlert, unknown: CircleHelp, none: CircleDashed }

/** Status is always icon + word + color, never color alone. */
export function StatusBadge({ status, label, size = 'md' }) {
  const { t } = useI18n()
  const Icon = STATUS_ICON[status] ?? CircleHelp
  return (
    <span className={`badge badge-${status} badge-${size}`}>
      <Icon aria-hidden="true" size={size === 'lg' ? 22 : 18} strokeWidth={2.4} />
      <span>{label ?? t(`status.${status}`)}</span>
    </span>
  )
}

function pickSpanishVoice() {
  const voices = window.speechSynthesis?.getVoices?.() ?? []
  const es = voices.filter((v) => v.lang?.toLowerCase().startsWith('es'))
  const pref = ['es-pe', 'es-419', 'es-us', 'es-mx', 'es-co', 'es-es']
  for (const p of pref) {
    const v = es.find((x) => x.lang.toLowerCase() === p)
    if (v) return v
  }
  return es.find((v) => v.localService) ?? es[0] ?? null
}

/** Reads Spanish text aloud with the phone's offline voice (speechSynthesis). */
export function SpeakButton({ text }) {
  const { t, lang } = useI18n()
  const [speaking, setSpeaking] = useState(false)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel() }, [supported])
  if (!supported || !text) return null

  const toggle = () => {
    const synth = window.speechSynthesis
    if (speaking) { synth.cancel(); setSpeaking(false); return }
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const voice = pickSpanishVoice()
    if (voice) u.voice = voice
    u.lang = voice?.lang ?? 'es-PE'
    u.rate = 0.9
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    setSpeaking(true)
    synth.speak(u)
  }

  return (
    <div className="speak">
      <button type="button" className="btn btn-quiet" onClick={toggle} aria-pressed={speaking}>
        {speaking ? <Square aria-hidden="true" size={20} /> : <Volume2 aria-hidden="true" size={22} />}
        <span>{speaking ? t('app.stop') : t('app.listen')}</span>
      </button>
      {lang === 'quy' && <p className="speak-note">{t('app.listenQuyNote')}</p>}
    </div>
  )
}

/** The explicit "I am not sure — ask the técnico" state. Never a guess. */
export function Unsure({ title, reason, children }) {
  const { t } = useI18n()
  return (
    <div className="unsure" role="status">
      <div className="unsure-head">
        <CircleHelp aria-hidden="true" size={30} strokeWidth={2.4} />
        <div>
          <p className="unsure-title">{title ?? t('app.unsure')}</p>
          <p className="unsure-ask"><UserRound aria-hidden="true" size={18} /> {t('app.askTech')}</p>
        </div>
      </div>
      {reason && <p className="unsure-reason">{reason}</p>}
      {children}
    </div>
  )
}

export function Source({ children }) {
  return (
    <p className="source">
      <BookOpen aria-hidden="true" size={15} />
      <span>{children}</span>
    </p>
  )
}

export function PageTitle({ icon: Icon, children }) {
  return (
    <h1 className="page-title">
      {Icon && <span className="page-title-icon"><Icon aria-hidden="true" size={26} strokeWidth={2.2} /></span>}
      {children}
    </h1>
  )
}
