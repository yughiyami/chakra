// Model card loader. Python's json.dump writes bare NaN / Infinity tokens,
// which are not valid JSON; replace them (outside strings) with null.

function sanitizeNonFinite(text) {
  let out = ''
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      out += c
      if (c === '\\') { out += text[i + 1] ?? ''; i++ }
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') { inString = true; out += c; continue }
    const rest = text.slice(i, i + 9)
    if (rest.startsWith('-Infinity')) { out += 'null'; i += 8; continue }
    if (rest.startsWith('Infinity')) { out += 'null'; i += 7; continue }
    if (rest.startsWith('NaN')) { out += 'null'; i += 2; continue }
    out += c
  }
  return out
}

export function parseModelCard(text) {
  if (typeof text !== 'string' || !text.trim()) return null
  try {
    return JSON.parse(sanitizeNonFinite(text))
  } catch {
    return null
  }
}

const num = (v) => (Number.isFinite(v) ? v : null)

/**
 * Flatten the fields the UI and decision gates need. Supports:
 *  v1: metrics[chosen] = {gates, size_mb, test, saposoa, far_ood}
 *  v2/v3: metrics = {bracol_test, saposoa_test, ojo_de_gallo_unseen (v2) | coleaf_deficiency_unseen (v3),
 *         far_ood, onnx_parity_max_logit_diff}
 */
export function summarizeModelCard(card) {
  if (!card || typeof card !== 'object') return null
  const m = card.metrics ?? {}
  const isV2 = 'bracol_test' in m || 'saposoa_test' in m
  let gates, test, sap, ogg, farOod, sizeMb, chosen
  const def = m.coleaf_deficiency_unseen ?? null
  if (isV2) {
    gates = card.gates ?? null
    test = m.bracol_test ?? {}
    sap = m.saposoa_test ?? null
    ogg = m.ojo_de_gallo_unseen ?? null
    farOod = m.far_ood ?? null
    sizeMb = num(card.size_mb)
    chosen = card.chosen ?? null
  } else {
    chosen = card.chosen && m[card.chosen] ? card.chosen : null
    const variant = chosen ? m[chosen] : {}
    gates = variant.gates ?? card.gates ?? null
    test = variant.test ?? {}
    sap = variant.saposoa ?? null
    ogg = sap?.ojo_de_gallo ?? null
    farOod = variant.far_ood ?? null
    sizeMb = num(variant.size_mb) ?? num(card.size_mb)
    chosen = chosen ?? card.chosen ?? null
  }
  const alpha = num(gates?.alpha)
  const saposoa = sap
    ? {
        n: num(sap.n),
        top1: num(sap.top1_acc),
        selectiveAcc: num(sap.selective_acc),
        answerRate: num(sap.answer_rate),
        ojoDeGalloAbstention: num(ogg?.abstention_rate),
      }
    : null
  const ojoDeGallo = ogg ? { n: num(ogg.n), abstentionRate: num(ogg.abstention_rate), auroc: num(ogg.auroc_vs_local_id) } : null
  const bracolAcc = num(test.selective_acc)
  let headline = null
  if (saposoa?.selectiveAcc != null) headline = { acc: saposoa.selectiveAcc, n: saposoa.n, set: 'saposoa' }
  else if (bracolAcc != null) headline = { acc: bracolAcc, n: num(test.n), set: 'bracol' }
  return {
    version: isV2 ? 2 : 1,
    model: card.model ?? null,
    format: card.format ?? null,
    chosen,
    classes: Array.isArray(card.classes) ? card.classes : null,
    gates,
    sizeMb,
    testN: num(test.n),
    top1: num(test.top1_acc),
    selectiveAcc: bracolAcc,
    answerRate: num(test.answer_rate),
    conformalCoverage: num(test.conformal_coverage),
    coverageTarget: alpha == null ? null : 1 - alpha,
    nCalib: num(gates?.n_calib),
    saposoa,
    ojoDeGallo,
    ojoDeGalloAbstention: ojoDeGallo?.abstentionRate ?? null,
    deficiency: def ? { n: num(def.n), abstentionRate: num(def.abstention_rate), auroc: num(def.auroc_vs_local_id) } : null,
    farOodRejection: num(farOod?.rejection_rate),
    farOodN: num(farOod?.n),
    onnxParity: num(m.onnx_parity_max_logit_diff),
    headline,
    notCovered: Array.isArray(card.not_covered) ? card.not_covered : [],
    data: card.data ?? null,
    training: card.training ?? null,
    localization: card.localization ?? card.data?.localization ?? null,
  }
}
