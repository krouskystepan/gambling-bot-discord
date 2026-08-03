import { describe, expect, it } from 'vitest'

import {
  decodeId,
  decodeModalId,
  encodeActionId,
  encodeModalId,
  encodePlaceId
} from '@/utils/casino/baccarat/customId'

describe('baccarat customId', () => {
  it('encodes and decodes place buttons', () => {
    const encoded = encodePlaceId({
      kind: 'place',
      gameId: 'abc',
      side: 'playerPair'
    })
    expect(encoded).toBe('bc:abc:p:playerPair')
    expect(decodeId(encoded)).toEqual({
      kind: 'place',
      gameId: 'abc',
      side: 'playerPair'
    })
  })

  it('encodes and decodes table actions', () => {
    for (const action of [
      'deal',
      'rebet',
      'undo',
      'clear',
      'close',
      'change'
    ] as const) {
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
    expect(decodeId('bc:abc:p:sideways')).toBeNull()
    expect(decodeId('bc:abc:a:explode')).toBeNull()
    expect(decodeId('bc:abc:x:player')).toBeNull()
    expect(decodeId('bc:abc:p')).toBeNull()
    expect(decodeId('bc::p:player')).toBeNull()
  })

  it('round-trips the bet modal id with side', () => {
    expect(
      decodeModalId(encodeModalId({ gameId: 'abc', side: 'perfectPair' }))
    ).toEqual({
      gameId: 'abc',
      side: 'perfectPair'
    })
    expect(decodeModalId('bc:abc')).toBeNull()
    expect(decodeModalId('bcm:abc')).toBeNull()
    expect(decodeModalId('bcm:abc:sideways')).toBeNull()
    expect(decodeModalId('bcm:')).toBeNull()
  })
})
