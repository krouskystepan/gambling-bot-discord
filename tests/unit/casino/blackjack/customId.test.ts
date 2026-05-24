import { describe, expect, it } from 'vitest'

import { decodeId, encodeId } from '@/utils/casino/blackjack/customId'

describe('blackjack customId', () => {
  it('round-trips encode and decode', () => {
    const payload = {
      betId: 'bet-abc',
      action: 'DOUBLE' as const,
      showBalance: true
    }

    const id = encodeId(payload)
    expect(id).toBe('bj:bet-abc:DOUBLE:1')
    expect(decodeId(id)).toEqual(payload)
  })

  it('decodes showBalance false', () => {
    expect(
      decodeId(encodeId({ betId: 'x', action: 'STAND', showBalance: false }))
    ).toMatchObject({ showBalance: false })
  })

  it('returns null for invalid ids', () => {
    expect(decodeId('not-bj')).toBeNull()
    expect(decodeId('bj:only:three')).toBeNull()
    expect(decodeId('bj:bet:INVALID:1')).toBeNull()
  })
})
