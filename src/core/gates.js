// Decision gates for the leaf classifier. This MUST mirror the Python
// implementation used to calibrate the model (ml/train.py) exactly:
//   p      = softmax(z / T)                       (temperature scaling, Guo et al. 2017)
//   energy = -T * logsumexp(z / T)                (energy OOD score, Liu et al. 2020)
//   if energy > energy_threshold        -> abstain "unfamiliar"
//   set = { k : p_k >= 1 - qhat }                 (split conformal, Angelopoulos & Bates 2021)
//   if |set| != 1 -> abstain ("ambiguous" if |set| > 1 else "unfamiliar")
//   else answer argmax
// The tool never guesses: every non-singleton outcome is an explicit abstention.

export const CLASSES = ['healthy', 'leaf_miner', 'rust', 'brown_leaf_spot', 'cercospora']

export function logsumexp(xs) {
  const m = Math.max(...xs)
  if (!Number.isFinite(m)) return m
  let s = 0
  for (const x of xs) s += Math.exp(x - m)
  return m + Math.log(s)
}

export function softmax(z, T = 1) {
  const scaled = z.map((v) => v / T)
  const lse = logsumexp(scaled)
  return scaled.map((v) => Math.exp(v - lse))
}

export function energyScore(z, T = 1) {
  return -T * logsumexp(z.map((v) => v / T))
}

function validGates(g) {
  return (
    g != null &&
    Number.isFinite(g.temperature) && g.temperature > 0 &&
    Number.isFinite(g.qhat) &&
    Number.isFinite(g.energy_threshold)
  )
}

/**
 * @param {number[]} logits raw model output, length = classes.length
 * @param {{temperature:number,qhat:number,energy_threshold:number}} gates
 * @param {string[]} classes
 * @returns {{status:'answer'|'abstain', reason?:string, label?:string, set:string[], probs:number[], energy:number|null}}
 */
export function decide(logits, gates, classes = CLASSES) {
  if (!validGates(gates)) return { status: 'abstain', reason: 'no_model', set: [], probs: [], energy: null }
  const z = Array.from(logits ?? [])
  if (z.length !== classes.length || z.some((v) => !Number.isFinite(v))) {
    return { status: 'abstain', reason: 'invalid', set: [], probs: [], energy: null }
  }
  const T = gates.temperature
  const probs = softmax(z, T)
  const energy = energyScore(z, T)

  // Candidates sorted by probability (most likely first) for display.
  const order = probs.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0])
  const cut = 1 - gates.qhat
  const setIdx = order.filter(([p]) => p >= cut).map(([, i]) => i)
  const set = setIdx.map((i) => classes[i])

  if (energy > gates.energy_threshold) {
    return { status: 'abstain', reason: 'unfamiliar', set, probs, energy }
  }
  if (set.length > 1) return { status: 'abstain', reason: 'ambiguous', set, probs, energy }
  if (set.length === 0) return { status: 'abstain', reason: 'unfamiliar', set, probs, energy }
  return { status: 'answer', label: classes[order[0][1]], set, probs, energy }
}
