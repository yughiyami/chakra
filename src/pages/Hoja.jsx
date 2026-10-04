import { useEffect, useRef, useState } from 'react'
import { Leaf, Camera, ImageUp, Ban, RefreshCw, LoaderCircle, Lock, UserRound, Sun, Hand, ZoomIn, FileImage } from 'lucide-react'
import { useI18n } from '../i18n/index.jsx'
import { useApp } from '../state/AppState.jsx'
import { checkQuality } from '../core/quality.js'
import { classify, decodeToRGBA, loadModelInfo, SIZE } from '../ai/classifier.js'
import { PageTitle, SpeakButton, StatusBadge, Unsure, Source } from '../components/ui.jsx'
import { pct } from '../components/format.js'
import { leafStatus } from '../state/status.js'

const TIP_ICONS = [Sun, FileImage, ZoomIn, Hand]
const RETAKE_ICONS = { dark: Sun, bright: Sun, blurry: Hand, no_leaf: ZoomIn, invalid: Camera }

function NeverSeen() {
  const { t } = useI18n()
  return (
    <section className="panel never" aria-labelledby="never-title">
      <h2 id="never-title" className="panel-title"><Ban aria-hidden="true" size={22} /> {t('hoja.neverSeenTitle')}</h2>
      <p className="muted">{t('hoja.neverSeenIntro')}</p>
      <ul className="never-list">
        {t('hoja.neverSeen').map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  )
}

function accuracyLine(t, info) {
  const h = info?.summary?.headline
  if (!h) return t('hoja.accuracyUnknown')
  return t(h.set === 'saposoa' ? 'hoja.accuracyPeru' : 'hoja.accuracyBracol', { n: h.n ?? '—', pct: pct(h.acc) })
}

function Result({ result, info }) {
  const { t, tEs } = useI18n()
  const status = leafStatus({ result })
  if (result.status === 'answer') {
    const label = result.label
    const advice = t(`hoja.advice.${label}`)
    const adviceEs = tEs(`hoja.advice.${label}`)
    const speech = [tEs('hoja.seemsTo'), tEs(`hoja.classes.${label}`), ...adviceEs, label === 'ojo_de_gallo' ? tEs('hoja.provisional') : '', tEs('app.confirmTech')].join(' ')
    return (
      <div className="result reveal">
        <p className="result-kicker-free">{t('hoja.seemsTo')}</p>
        <p className="verdict">{t(`hoja.classes.${label}`)}</p>
        <StatusBadge status={status} size="lg" />
        <p className="accuracy">{accuracyLine(t, info)}</p>
        <ul className="advice">
          {advice.map((a) => <li key={a}>{a}</li>)}
        </ul>
        <p className="confirm"><UserRound aria-hidden="true" size={22} /> {t('app.confirmTech')}</p>
        {label === 'ojo_de_gallo' && <p className="banner banner-demo">{t('hoja.provisional')}</p>}
        <SpeakButton text={speech} />
        <Source>{t('hoja.adviceSources')}</Source>
        {label === 'ojo_de_gallo' && <Source>{t('hoja.ojoSource')}</Source>}
      </div>
    )
  }
  const reasonKey = { unfamiliar: 'hoja.unfamiliar', no_model: 'hoja.noModel', invalid: 'hoja.invalidOut' }[result.reason]
  const reason = result.reason === 'ambiguous'
    ? t('hoja.ambiguous', { list: result.set.map((c) => t(`hoja.classes.${c}`)).join(', ') })
    : t(reasonKey ?? 'hoja.unfamiliar')
  const reasonEs = result.reason === 'ambiguous'
    ? tEs('hoja.ambiguous', { list: result.set.map((c) => tEs(`hoja.classes.${c}`)).join(', ') })
    : tEs(reasonKey ?? 'hoja.unfamiliar')
  return (
    <div className="reveal">
      <Unsure reason={reason}>
        <SpeakButton text={`${tEs('app.unsure')}. ${tEs('app.askTech')} ${reasonEs}`} />
      </Unsure>
    </div>
  )
}

export default function Hoja() {
  const { t, tEs } = useI18n()
  const { state, update } = useApp()
  const [phase, setPhase] = useState('idle')
  const [preview, setPreview] = useState(null)
  const [issues, setIssues] = useState([])
  const [result, setResult] = useState(null)
  const [info, setInfo] = useState(null)
  const camRef = useRef(null)
  const galRef = useRef(null)
  const outRef = useRef(null)

  useEffect(() => {
    if (phase === 'result' || phase === 'retake') outRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [phase])

  useEffect(() => { loadModelInfo().then(setInfo).catch(() => setInfo(null)) }, [])

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setResult(null)
    setIssues([])
    setPhase('checking')
    try {
      const { rgba, preview: p } = await decodeToRGBA(file)
      setPreview(p)
      const q = checkQuality(rgba, SIZE, SIZE)
      if (!q.ok) { setIssues(q.issues); setPhase('retake'); return }
      setPhase('loading')
      let r
      try {
        r = await classify(rgba)
      } catch {
        r = { status: 'abstain', reason: 'no_model', set: [] }
      }
      // Store only the decision (no photo, no logits) for the home summary and card.
      const stored = { status: r.status, reason: r.reason ?? null, label: r.label ?? null, set: r.set ?? [] }
      update({ leaf: { result: stored, at: new Date().toISOString() } })
      setResult(stored)
      setPhase('result')
    } catch {
      setIssues(['invalid'])
      setPhase('retake')
    }
  }

  const busy = phase === 'checking' || phase === 'loading'
  const busyText = phase === 'checking' ? t('hoja.checking') : t('hoja.loadingModel')
  const retakeSpeech = [...issues.map((i) => tEs(`hoja.retake.${i}`)), tEs('hoja.retake.underside')].join(' ')

  return (
    <section className="page" aria-labelledby="hoja-title">
      <PageTitle icon={Leaf}><span id="hoja-title">{t('hoja.title')}</span></PageTitle>
      <p className="lead">{t('hoja.intro')}</p>

      {phase === 'idle' && !state.leaf && (
        <ul className="tips">
          {t('hoja.tips').map((tip, i) => {
            const Icon = TIP_ICONS[i] ?? Leaf
            return <li key={tip}><Icon aria-hidden="true" size={22} /> {tip}</li>
          })}
        </ul>
      )}

      <div className="capture">
        <button type="button" className="btn btn-primary btn-xl" onClick={() => camRef.current?.click()} disabled={busy}>
          <Camera aria-hidden="true" size={28} /> {phase === 'idle' ? t('hoja.take') : t('hoja.again')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => galRef.current?.click()} disabled={busy}>
          <ImageUp aria-hidden="true" size={22} /> {t('hoja.gallery')}
        </button>
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} aria-label={t('hoja.take')} />
        <input ref={galRef} type="file" accept="image/*" hidden onChange={onFile} aria-label={t('hoja.gallery')} />
        <p className="privacy-line"><Lock aria-hidden="true" size={16} /> {t('hoja.photoPrivate')}</p>
      </div>

      <div ref={outRef} className="outcome" aria-live="polite" aria-busy={busy}>
        {preview && phase !== 'idle' && <img className="photo" src={preview} alt="" />}
        {busy && <p className="busy"><LoaderCircle className="spin" aria-hidden="true" size={22} /> {busyText}</p>}
        {phase === 'retake' && (
          <div className="panel retake reveal" role="status">
            <h2 className="panel-title"><RefreshCw aria-hidden="true" size={22} /> {t('hoja.retakeTitle')}</h2>
            <ul className="retake-list">
              {issues.map((i) => {
                const Icon = RETAKE_ICONS[i] ?? Camera
                return <li key={i}><Icon aria-hidden="true" size={24} /> {t(`hoja.retake.${i}`)}</li>
              })}
              <li><FileImage aria-hidden="true" size={24} /> {t('hoja.retake.underside')}</li>
            </ul>
            <SpeakButton text={retakeSpeech} />
          </div>
        )}
        {phase === 'result' && result && <Result result={result} info={info} />}
      </div>

      <NeverSeen />
    </section>
  )
}
