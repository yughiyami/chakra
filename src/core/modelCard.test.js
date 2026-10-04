import { describe, it, expect } from 'vitest'
import { parseModelCard, summarizeModelCard } from './modelCard.js'

const RAW = `{
  "size_mb": 6.1,
  "classes": ["healthy","leaf_miner","rust","brown_leaf_spot","cercospora"],
  "gates": {"temperature": 3.3, "qhat": 0.91, "energy_threshold": -4.2, "alpha": 0.1, "n_calib": 201},
  "metrics": {
    "fp32": {"gates": {"temperature": 3.3, "qhat": 0.91, "energy_threshold": -4.2, "alpha": 0.1, "n_calib": 201},
             "size_mb": 6.1,
             "test": {"n": 203, "top1_acc": 0.5369, "conformal_coverage": 0.8916, "answer_rate": 0.0788, "selective_acc": 0.875},
             "saposoa": {"n": 300, "top1_acc": 0.4, "answer_rate": 0.05, "selective_acc": 0.7, "ojo_de_gallo": {"n": 60, "abstention_rate": 0.95}},
             "far_ood": {"n": 80, "rejection_rate": 0.5}},
    "int8": {"gates": {"temperature": 36.2, "qhat": 0.8, "energy_threshold": -57, "alpha": 0.1, "n_calib": 201},
             "size_mb": 1.85,
             "test": {"n": 203, "top1_acc": 0.14, "selective_acc": NaN}}
  },
  "chosen": "fp32",
  "not_covered": ["ojo de gallo"]
}`

describe('parseModelCard', () => {
  it('tolerates bare NaN / Infinity tokens emitted by Python json.dump', () => {
    const card = parseModelCard(RAW)
    expect(card.metrics.int8.test.selective_acc).toBeNull()
    expect(card.chosen).toBe('fp32')
  })

  it('does not corrupt strings containing NaN', () => {
    const card = parseModelCard('{"model": "NaN-free name with NaN inside", "x": NaN}')
    expect(card.model).toBe('NaN-free name with NaN inside')
    expect(card.x).toBeNull()
  })

  it('returns null for unparseable input', () => {
    expect(parseModelCard('not json')).toBeNull()
    expect(parseModelCard('')).toBeNull()
  })
})

describe('summarizeModelCard', () => {
  it('uses the chosen variant gates and test metrics', () => {
    const s = summarizeModelCard(parseModelCard(RAW))
    expect(s.chosen).toBe('fp32')
    expect(s.gates.temperature).toBe(3.3)
    expect(s.selectiveAcc).toBe(0.875)
    expect(s.coverageTarget).toBeCloseTo(0.9)
    expect(s.answerRate).toBe(0.0788)
    expect(s.sizeMb).toBe(6.1)
    expect(s.saposoa.ojoDeGalloAbstention).toBe(0.95)
    expect(s.farOodRejection).toBe(0.5)
    expect(s.classes).toHaveLength(5)
  })

  it('falls back to top-level gates when the chosen variant is missing', () => {
    const card = parseModelCard(RAW)
    delete card.chosen
    const s = summarizeModelCard(card)
    expect(s.gates.temperature).toBe(3.3)
  })

  it('returns null for missing card', () => {
    expect(summarizeModelCard(null)).toBeNull()
  })
})

describe('summarizeModelCard (v2 flat metrics contract)', () => {
  const v2 = {
    size_mb: 6.2,
    classes: ['healthy', 'leaf_miner', 'rust', 'brown_leaf_spot', 'cercospora'],
    gates: { temperature: 2, qhat: 0.9, energy_threshold: -5, mahalanobis_threshold: 80, alpha: 0.1, n_calib: 201 },
    metrics: {
      bracol_test: { n: 203, top1_acc: 0.8, selective_acc: 0.95, answer_rate: 0.6, conformal_coverage: 0.9 },
      saposoa_test: { n: 60, top1_acc: 0.7, selective_acc: 0.9, answer_rate: 0.5 },
      ojo_de_gallo_unseen: { n: 60, abstention_rate: 0.85, auroc_vs_local_id: 0.91 },
      far_ood: { n: 80, rejection_rate: 0.97 },
      onnx_parity_max_logit_diff: 0.00002,
    },
  }

  it('reads flat metric keys and the mahalanobis threshold', () => {
    const s = summarizeModelCard(v2)
    expect(s.version).toBe(2)
    expect(s.gates.mahalanobis_threshold).toBe(80)
    expect(s.selectiveAcc).toBe(0.95)
    expect(s.saposoa.selectiveAcc).toBe(0.9)
    expect(s.saposoa.n).toBe(60)
    expect(s.ojoDeGallo.abstentionRate).toBe(0.85)
    expect(s.ojoDeGallo.auroc).toBe(0.91)
    expect(s.ojoDeGalloAbstention).toBe(0.85)
    expect(s.farOodRejection).toBe(0.97)
    expect(s.onnxParity).toBe(0.00002)
    expect(s.sizeMb).toBe(6.2)
  })

  it('prefers the Peru (Saposoa) selective accuracy for the headline statement', () => {
    expect(summarizeModelCard(v2).headline).toEqual({ acc: 0.9, n: 60, set: 'saposoa' })
  })

  it('falls back to BRACOL for the headline when Saposoa is missing', () => {
    const card = { ...v2, metrics: { ...v2.metrics, saposoa_test: null } }
    expect(summarizeModelCard(card).headline).toEqual({ acc: 0.95, n: 203, set: 'bracol' })
  })
})

describe('summarizeModelCard (v3: 6 classes + CoLeaf deficiency never-seen test)', () => {
  const v3 = {
    version: '3.0.0',
    classes: ['healthy', 'leaf_miner', 'rust', 'brown_leaf_spot', 'cercospora', 'ojo_de_gallo'],
    gates: { temperature: 1, qhat: 0.6, energy_threshold: -1, mahalanobis_threshold: 40, alpha: 0.1 },
    metrics: {
      bracol_test: { n: 203, selective_acc: 0.9 },
      saposoa_test: { n: 80, selective_acc: 0.85 },
      coleaf_deficiency_unseen: { n: 120, abstention_rate: 0.7, auroc_vs_local_id: 0.88 },
      far_ood: { rejection_rate: 1 },
    },
  }
  it('exposes the class list and the deficiency abstention metric', () => {
    const s = summarizeModelCard(v3)
    expect(s.version).toBe(2)
    expect(s.classes).toHaveLength(6)
    expect(s.deficiency).toEqual({ n: 120, abstentionRate: 0.7, auroc: 0.88 })
    expect(s.ojoDeGallo).toBeNull()
    expect(s.headline).toEqual({ acc: 0.85, n: 80, set: 'saposoa' })
  })
})
