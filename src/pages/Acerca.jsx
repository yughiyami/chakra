import { useEffect, useState } from 'react'
import { Info, Cpu, MapPinned, Ban, Lock, Database, Languages, BookOpen, HandHeart } from 'lucide-react'
import { useI18n } from '../i18n/index.jsx'
import { loadModelInfo } from '../ai/classifier.js'
import { CITATIONS, DATASETS } from '../i18n/citations.js'
import { PageTitle } from '../components/ui.jsx'
import { pct } from '../components/format.js'

function Section({ icon: Icon, title, children, id }) {
  return (
    <section className="panel" aria-labelledby={id}>
      <h2 id={id} className="panel-title"><Icon aria-hidden="true" size={22} /> {title}</h2>
      {children}
    </section>
  )
}

function ModelFacts({ info }) {
  const { t } = useI18n()
  const s = info?.summary
  if (!s) return <p className="muted">{t('acerca.modelMissing')}</p>
  const facts = []
  if (s.sizeMb != null) facts.push(t('acerca.size', { mb: s.sizeMb }))
  if (s.saposoa?.selectiveAcc != null || s.saposoa?.answerRate != null) {
    facts.push(t('acerca.peruTest', { n: s.saposoa.n ?? '—', answer: pct(s.saposoa.answerRate), acc: pct(s.saposoa.selectiveAcc) }))
  }
  if (s.top1 != null) facts.push(t('acerca.bracolTest', { n: s.testN ?? '—', top1: pct(s.top1), answer: pct(s.answerRate), acc: pct(s.selectiveAcc) }))
  if (s.coverageTarget != null) facts.push(t('acerca.coverage', { cov: pct(s.conformalCoverage ?? s.coverageTarget) }))
  if (s.ojoDeGalloAbstention != null) facts.push(t('acerca.ojo', { rate: pct(s.ojoDeGalloAbstention) }))
  if (s.farOodRejection != null) facts.push(t('acerca.farOod', { rate: pct(s.farOodRejection) }))
  const oodReady = info.ood && Number.isFinite(s.gates?.mahalanobis_threshold)
  facts.push(oodReady ? t('acerca.oodOn') : t('acerca.oodOff'))
  if (s.onnxParity != null) facts.push(t('acerca.parity', { d: s.onnxParity.toExponential(1) }))
  return (
    <>
      <ul className="facts-list">{facts.map((f) => <li key={f}>{f}</li>)}</ul>
      {s.model && <p className="fine">{s.model}{s.format ? ` · ${s.format}` : ''}</p>}
    </>
  )
}

export default function Acerca() {
  const { t } = useI18n()
  const [info, setInfo] = useState(null)
  useEffect(() => { loadModelInfo().then(setInfo).catch(() => setInfo({ summary: null, ood: null })) }, [])

  return (
    <section className="page" aria-labelledby="acerca-title">
      <PageTitle icon={Info}><span id="acerca-title">{t('acerca.title')}</span></PageTitle>
      <p className="lead">{t('acerca.what')}</p>
      <p className="decide-note"><HandHeart aria-hidden="true" size={22} /> {t('acerca.human')}</p>

      <Section icon={MapPinned} title={t('acerca.localTitle')} id="ac-local">
        <p className="body">{t('acerca.local')}</p>
      </Section>

      <Section icon={Cpu} title={t('acerca.modelTitle')} id="ac-model">
        <ModelFacts info={info} />
      </Section>

      <Section icon={Ban} title={t('acerca.notCoveredTitle')} id="ac-not">
        <ul className="never-list">{t('acerca.notCovered').map((x) => <li key={x}>{x}</li>)}</ul>
      </Section>

      <Section icon={Lock} title={t('acerca.privacyTitle')} id="ac-priv">
        <ul className="check-list">{t('acerca.privacy').map((x) => <li key={x}>{x}</li>)}</ul>
      </Section>

      <Section icon={Languages} title={t('acerca.langTitle')} id="ac-lang">
        <p className="banner banner-demo">{t('acerca.quyDraft')}</p>
        <p className="body">{t('acerca.voice')}</p>
      </Section>

      <Section icon={Database} title={t('acerca.dataTitle')} id="ac-data">
        <table className="data-table">
          <tbody>
            {DATASETS.map((d) => (
              <tr key={d.name}><th scope="row">{d.name}<small>{d.use}</small></th><td>{d.license}</td></tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section icon={BookOpen} title={t('acerca.citesTitle')} id="ac-cites">
        <ol className="cites">{CITATIONS.map((c) => <li key={c}>{c}</li>)}</ol>
      </Section>
      <p className="fine center">{t('acerca.version', { v: __APP_VERSION__ })}</p>
    </section>
  )
}
