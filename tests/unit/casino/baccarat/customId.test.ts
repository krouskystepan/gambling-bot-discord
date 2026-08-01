import { describe, expect, it } from 'vitest'

import {
  decodeId,
  decodeModalId,
  encodeActionId,
  encodeModalId,
  encodeSideId
} from '@/utils/casino/baccarat/customId'

describe('baccarat customId', () => {
  it('encodes and decodes side buttons', () => {
    const encoded = encodeSideId({
      kind: 'side',
      gameId: 'abc',
      side: 'playerPair'
    })
    expect(encoded).toBe('bc:abc:s:playerPair')
    expect(decodeId(encoded)).toEqual({
      kind: 'side',
      gameId: 'abc',
      side: 'playerPair'
    })
  })

  it('encodes and decodes table actions', () => {
    for (const action of ['rebet', 'change', 'close', 'amount'] as const) {
      const encoded = encodeActionId({ kind: 'action', gameId: 'abc', action })
      expect(encoded).toBe(`bc:abc:a:${action}`)
      expect(decodeId(encoded)).toEqual({
        kind: 'action',
        gameId: 'abc',
        action
      })
    }
  })

  it('rejects invalid ids', () => {
    expect(decodeId('bj:abc:HIT:1')).toBeNull()
    expect(decodeId('bc:abc:s:sideways')).toBeNull()
    expect(decodeId('bc:abc:a:explode')).toBeNull()
    expect(decodeId('bc:abc:x:player')).toBeNull()
    expect(decodeId('bc:abc:s')).toBeNull()
    expect(decodeId('bc::s:player')).toBeNull()
  })

  it('round-trips the bet modal id', () => {
    expect(decodeModalId(encodeModalId({ gameId: 'abc' }))).toEqual({
      gameId: 'abc'
    })
    expect(decodeModalId('bc:abc')).toBeNull()
    expect(decodeModalId('bcm:abc:extra')).toBeNull()
    expect(decodeModalId('bcm:')).toBeNull()
  })
})
