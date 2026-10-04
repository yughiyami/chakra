import { describe, it, expect } from 'vitest'
import { buildCard, toAscii, shareLinks, addToOutbox, CARD_MAX } from './card.js'

const isAscii = (s) => /^[\x20-\x7E]*$/.test(s)

const full = {
  date: '2026-10-04',
  farm: 'VRICA',
  leaf: { status: 'abstain', reason: 'ambiguous', set: ['rust', 'cercospora'] },
  weather: { status: 'ok', rust: { status: 'ok', risk: 'high' }, incubation: { status: 'ok', days: 22 }, broca: { status: 'ok', dd: 210.4, target: 332 } },
  price: { status: 'below', offerKg: 14, band: { lowKg: 16.107, highKg: 18.318 } },
}

describe('buildCard', () => {
  it('builds the documented example', () => {
    expect(buildCard(full)).toBe('CHAKRA1 2026-10-04 F:VRICA H:roya? (abst) R:ALTA I:22d DD:210/332 P:14.0<16.1-18.3 S/kg')
  })

  it('stays ASCII and <= 160 chars', () => {
    const c = buildCard(full)
    expect(c.length).toBeLessThanOrEqual(CARD_MAX)
    expect(CARD_MAX).toBe(160)
    expect(isAscii(c)).toBe(true)
  })

  it('writes a confident answer without the abstain marker', () => {
    const c = buildCard({ ...full, leaf: { status: 'answer', label: 'leaf_miner' } })
    expect(c).toContain('H:minador ')
  })

  it('marks unfamiliar leaves and unknown modules with ?', () => {
    const c = buildCard({ date: '2026-10-04', farm: null, leaf: { status: 'abstain', reason: 'unfamiliar' }, weather: { status: 'stale' }, price: { status: 'unknown' } })
    expect(c).toBe('CHAKRA1 2026-10-04 F:? H:? (abst) R:? P:?')
  })

  it('handles completely empty input', () => {
    expect(buildCard({ date: '2026-10-04' })).toBe('CHAKRA1 2026-10-04 F:? H:- R:- P:-')
  })

  it('uses = inside and > above the band', () => {
    expect(buildCard({ ...full, price: { ...full.price, status: 'inside', offerKg: 17 } })).toContain('P:17.0=16.1-18.3')
    expect(buildCard({ ...full, price: { ...full.price, status: 'above', offerKg: 19 } })).toContain('P:19.0>16.1-18.3')
  })

  it('strips accents and non-ASCII from farm codes and truncates very long input', () => {
    const c = buildCard({ ...full, farm: 'Ñuñoa-Jaén-'.repeat(40) })
    expect(isAscii(c)).toBe(true)
    expect(c.length).toBeLessThanOrEqual(160)
    expect(c).toContain('F:NUNOA')
  })
})

describe('helpers', () => {
  it('toAscii removes diacritics', () => {
    expect(toAscii('Jaén Ñuñoa café')).toBe('Jaen Nunoa cafe')
  })

  it('builds WhatsApp and SMS links with encoded text', () => {
    const l = shareLinks('A B&C')
    expect(l.whatsapp).toBe('https://wa.me/?text=A%20B%26C')
    expect(l.sms).toBe('sms:?body=A%20B%26C')
  })

  it('keeps an outbox newest-first, capped at 50', () => {
    let box = []
    for (let i = 0; i < 55; i++) box = addToOutbox(box, `code ${i}`, `2026-10-04T10:${String(i).padStart(2, '0')}:00Z`)
    expect(box).toHaveLength(50)
    expect(box[0].text).toBe('code 54')
    expect(box[0].createdAt).toBe('2026-10-04T10:54:00Z')
    expect(box[0].sent).toBe(false)
  })
})
