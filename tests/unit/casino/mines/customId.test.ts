import { describe, expect, it } from 'vitest'

import {
  decodeId,
  decodeModalId,
  encodeId,
  encodeModalId
} from '@/utils/casino/mines/customId'

describe('mines customId', () => {
  it('round-trips cell and cashout ids', () => {
    const cell = encodeId({
      gameId: 'abc',
      action: { kind: 'cell', cellIndex: 7 },
      showBalance: true
    })
    expect(cell).toBe('mines:abc:cell:7:1')
    expect(decodeId(cell)).toEqual({
      gameId: 'abc',
      action: { kind: 'cell', cellIndex: 7 },
      showBalance: true
    })

    const cash = encodeId({
      gameId: 'abc',
      action: { kind: 'cashout' },
      showBalance: false
    })
    expect(cash).toBe('mines:abc:CASHOUT:0')
    expect(decodeId(cash)).toEqual({
      gameId: 'abc',
      action: { kind: 'cashout' },
      showBalance: false
    })
  })

  it('round-trips table actions', () => {
    for (const action of ['rebet', 'change', 'close'] as const) {
      const encoded = encodeId({
        gameId: 'abc',
        action: { kind: 'action', action },
        showBalance: true
      })
      expect(encoded).toBe(`mines:abc:a:${action}:1`)
      expect(decodeId(encoded)).toEqual({
        gameId: 'abc',
        action: { kind: 'action', action },
        showBalance: true
      })
    }
  })

  it('rejects invalid ids', () => {
    expect(decodeId('bj:abc:HIT:1')).toBeNull()
    expect(decodeId('mines:abc:cell')).toBeNull()
    expect(decodeId('mines:abc:CASHOUT:1:extra')).toBeNull()
    expect(decodeId('mines:abc:cell:7')).toBeNull()
    expect(decodeId('mines:abc:cell:x:1')).toBeNull()
    expect(decodeId('mines:abc:a:explode:1')).toBeNull()
    expect(decodeId('mines:abc:a:rebet')).toBeNull()
    expect(decodeId('mines:abc:NOPE:1')).toBeNull()
  })

  it('round-trips the settings modal id', () => {
    expect(decodeModalId(encodeModalId({ gameId: 'abc' }))).toEqual({
      gameId: 'abc'
    })
    expect(decodeModalId('mines:abc')).toBeNull()
    expect(decodeModalId('minesm:abc:extra')).toBeNull()
    expect(decodeModalId('minesm:')).toBeNull()
  })
})
