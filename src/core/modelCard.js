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

/** Flatten the fields the UI and decision gates need from the chosen variant. */
export function summarizeModelCard(card) {
  if (!card || typeof card !== 'object') return null
  const chosen = card.chosen && card.metrics?.[card.chosen] ? card.chosen : null
  const variant = chosen ? card.metrics[chosen] : {}
  const gates = variant.gates ?? card.gates ?? null
  const test = variant.test ?? {}
  const sap = variant.saposoa ?? null
  const alpha = num(gates?.alpha)
  return {
    model: card.model ?? null,
    format: card.format ?? null,
    chosen: chosen ?? card.chosen ?? null,
    classes: Array.isArray(card.classes) ? card.classes : null,
    gates,
    sizeMb: num(variant.size_mb) ?? num(card.size_mb),
    testN: num(test.n),
    top1: num(test.top1_acc),
    selectiveAcc: num(test.selective_acc),
    answerRate: num(test.answer_rate),
    conformalCoverage: num(test.conformal_coverage),
    coverageTarget: alpha == null ? null : 1 - alpha,
    nCalib: num(gates?.n_calib),
    saposoa: sap
      ? {
          n: num(sap.n),
          top1: num(sap.top1_acc),
          selectiveAcc: num(sap.selective_acc),
          answerRate: num(sap.answer_rate),
          ojoDeGalloAbstention: num(sap.ojo_de_gallo?.abstention_rate),
        }
      : null,
    farOodRejection: num(variant.far_ood?.rejection_rate),
    farOodN: num(variant.far_ood?.n),
    notCovered: Array.isArray(card.not_covered) ? card.not_covered : [],
    data: card.data ?? null,
    training: card.training ?? null,
  }
}
