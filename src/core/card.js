// Evidence card: a short, SMS-safe (ASCII, <=160 chars) code that summarises the
// latest results so a técnico or cooperative can read it. Store-and-forward:
// nothing is sent automatically — the person decides when and to whom.

export const CARD_MAX = 160
export const CARD_PREFIX = 'CHAKRA1'
const OUTBOX_MAX = 50

export const LEAF_CODES = {
  healthy: 'sano',
  leaf_miner: 'minador',
  rust: 'roya',
  brown_leaf_spot: 'phoma',
  cercospora: 'cercos',
  ojo_de_gallo: 'ojogallo',
}
const RISK_CODES = { high: 'ALTA', medium: 'MEDIA', low: 'BAJA' }
const PRICE_SIGN = { below: '<', inside: '=', above: '>' }

export function toAscii(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
}

function farmCode(farm) {
  const code = toAscii(farm).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  return code || '?'
}

function leafPart(leaf) {
  if (!leaf) return 'H:-'
  if (leaf.status === 'answer') return `H:${LEAF_CODES[leaf.label] ?? '?'}`
  if (leaf.reason === 'ambiguous' && leaf.set?.length) return `H:${LEAF_CODES[leaf.set[0]] ?? '?'}? (abst)`
  return 'H:? (abst)'
}

function weatherParts(w) {
  if (!w) return ['R:-']
  if (w.status !== 'ok') return ['R:?']
  const parts = [`R:${w.rust?.status === 'ok' ? RISK_CODES[w.rust.risk] : '?'}`]
  if (w.incubation?.status === 'ok') parts.push(`I:${w.incubation.days}d`)
  if (w.broca?.status === 'ok') parts.push(`DD:${Math.round(w.broca.dd)}/${w.broca.target}`)
  return parts
}

function pricePart(p) {
  if (!p) return 'P:-'
  const sign = PRICE_SIGN[p.status]
  if (!sign || !p.band) return 'P:?'
  return `P:${p.offerKg.toFixed(1)}${sign}${p.band.lowKg.toFixed(1)}-${p.band.highKg.toFixed(1)} S/kg`
}

/**
 * @param {{date:string, farm?:string, leaf?:object, weather?:object, price?:object}} input
 */
export function buildCard({ date, farm, leaf, weather, price }) {
  const parts = [CARD_PREFIX, toAscii(date).slice(0, 10), `F:${farmCode(farm)}`, leafPart(leaf), ...weatherParts(weather), pricePart(price)]
  const text = toAscii(parts.join(' '))
  return text.length <= CARD_MAX ? text : text.slice(0, CARD_MAX)
}

export function shareLinks(text) {
  const enc = encodeURIComponent(text)
  return { whatsapp: `https://wa.me/?text=${enc}`, sms: `sms:?body=${enc}` }
}

/** Pure outbox update: newest first, capped. */
export function addToOutbox(outbox, text, createdAt) {
  const entry = { id: `${createdAt}-${outbox.length}`, text, createdAt, sent: false }
  return [entry, ...(outbox ?? [])].slice(0, OUTBOX_MAX)
}
