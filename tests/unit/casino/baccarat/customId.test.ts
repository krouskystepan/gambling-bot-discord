import { describe, expect, it } from 'vitest'

import { decodeId, encodeId } from '@/utils/casino/baccarat/customId'

describe('baccarat customId', () => {
  it('encodes and decodes side buttons', () => {
    const encoded = encodeId({
      betId: 'abc',
      side: 'playerPair',
      showBalance: true,
      skipAnimations: false
    })
    expect(encoded).toBe('bc:abc:playerPair:1:0')
    expect(decodeId(encoded)).toEqual({
      betId: 'abc',
      side: 'playerPair',
      showBalance: true,
      skipAnimations: false
    })

    expect(
      encodeId({
        betId: 'abc',
        side: 'tie',
        showBalance: false,
        skipAnimations: true
      })
    ).toBe('bc:abc:tie:0:1')
  })

  it('rejects invalid ids', () => {
    expect(decodeId('bj:abc:HIT:1')).toBeNull()
    expect(decodeId('bc:abc:sideways:0:0')).toBeNull()
    expect(decodeId('bc:abc:player:0')).toBeNull()
    expect(decodeId('bc::player:0:0')).toBeNull()
  })
})
