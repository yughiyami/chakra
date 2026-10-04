// Decision gates for the leaf classifier. This MUST mirror the Python
// implementation used to calibrate the model (ml/train.py) exactly:
//   p      = softmax(z / T)                       (temperature scaling, Guo et al. 2017)
//   energy = -T * logsumexp(z / T)                (energy OOD score, Liu et al. 2020)
//   maha   = min_c (g - mu_c)^T P (g - mu_c), g = W (f - mean)  (Mahalanobis, Lee et al. 2018)
//   if energy > energy_threshold OR maha > mahalanobis_threshold -> abstain "unfamiliar"
//   set = { k : p_k >= 1 - qhat }                 (split conformal, Angelopoulos & Bates 2021)
//   if |set| != 1 -> abstain ("ambiguous" if |set| > 1 else "unfamiliar")
//   else answer argmax
// The tool never guesses: every non-singleton outcome is an explicit abstention.

// v3 class order. The app always passes the list read from model_card.json;
// this constant is only a documented default.
export const CLASSES = ['healthy', 'leaf_miner', 'rust', 'brown_leaf_spot', 'cercospora', 'ojo_de_gallo']

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
 * @param {{mahalanobis?:number|null}} ood optional feature-space OOD score (v2 models)
 * @returns {{status:'answer'|'abstain', reason?:string, label?:string, set:string[], probs:number[], energy:number|null, mahalanobis:number|null, oodGate:'passed'|'failed'|'skipped'}}
 */
export function decide(logits, gates, classes = CLASSES, { mahalanobis = null } = {}) {
  if (!validGates(gates) || !Array.isArray(classes) || classes.length < 2) return { status: 'abstain', reason: 'no_model', set: [], probs: [], energy: null }
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

  const mahaThr = gates.mahalanobis_threshold
  const mahaActive = Number.isFinite(mahaThr) && Number.isFinite(mahalanobis)
  const mahaFail = mahaActive && mahalanobis > mahaThr
  const base = { set, probs, energy, mahalanobis: Number.isFinite(mahalanobis) ? mahalanobis : null, oodGate: mahaActive ? (mahaFail ? 'failed' : 'passed') : 'skipped' }

  if (energy > gates.energy_threshold || mahaFail) return { status: 'abstain', reason: 'unfamiliar', ...base }
  if (set.length > 1) return { status: 'abstain', reason: 'ambiguous', ...base }
  if (set.length === 0) return { status: 'abstain', reason: 'unfamiliar', ...base }
  return { status: 'answer', label: classes[order[0][1]], ...base }
}

/**
 * Feature-space OOD score (v2 models). g = components · (f - feat_mean);
 * score = min over classes c of (g - class_means[c])^T · precision · (g - class_means[c]).
 * Returns null when inputs are missing or shapes do not match (gate is then skipped).
 */
export function mahalanobisScore(features, ood) {
  if (!ood || !features) return null
  const { feat_mean: mu, components: W, class_means: M, precision: P } = ood
  if (!Array.isArray(mu) || !Array.isArray(W) || !Array.isArray(M) || !Array.isArray(P)) return null
  const f = Array.from(features)
  if (f.length !== mu.length || W.some((row) => row.length !== mu.length)) return null
  const k = W.length
  const g = new Float64Array(k)
  for (let i = 0; i < k; i++) {
    let acc = 0
    const row = W[i]
    for (let j = 0; j < f.length; j++) acc += row[j] * (f[j] - mu[j])
    g[i] = acc
  }
  let best = Infinity
  for (const m of M) {
    if (m.length !== k) return null
    const d = new Float64Array(k)
    for (let i = 0; i < k; i++) d[i] = g[i] - m[i]
    let q = 0
    for (let i = 0; i < k; i++) {
      let r = 0
      for (let j = 0; j < k; j++) r += P[i][j] * d[j]
      q += d[i] * r
    }
    if (q < best) best = q
  }
  return Number.isFinite(best) ? best : null
}
