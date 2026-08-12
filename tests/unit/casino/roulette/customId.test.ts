import { describe, expect, it } from 'vitest'

import {
  decodeId,
  decodeModalId,
  encodeActionId,
  encodeModalId,
  encodePlaceId,
  encodeSelectId
} from '@/utils/casino/roulette/customId'

describe('roulette customId', () => {
  it('encodes and decodes place buttons', () => {
    const encoded = encodePlaceId({
      kind: 'place',
      gameId: 'abc',
      target: 'red'
    })
    expect(encoded).toBe('rl:abc:p:red')
    expect(decodeId(encoded)).toEqual({
      kind: 'place',
      gameId: 'abc',
      target: 'red'
    })
  })

  it('encodes and decodes actions and selects', () => {
    expect(
      decodeId(encodeActionId({ kind: 'action', gameId: 'g1', action: 'spin' }))
    ).toEqual({ kind: 'action', gameId: 'g1', action: 'spin' })

    expect(
      decodeId(
        encodeSelectId({ kind: 'select', gameId: 'g1', select: 'group' })
      )
    ).toEqual({ kind: 'select', gameId: 'g1', select: 'group' })
  })

  it('encodes and decodes amount modals', () => {
    const encoded = encodeModalId({ gameId: 'g1', target: 'd2' })
    expect(encoded).toBe('rlm:g1:d2')
    expect(decodeModalId(encoded)).toEqual({ gameId: 'g1', target: 'd2' })
  })

  it('rejects invalid ids', () => {
    expect(decodeId('bc:abc:player:0:0')).toBeNull()
    expect(decodeId('rl:abc:p')).toBeNull()
    expect(decodeId('rl:abc:p:red:extra')).toBeNull()
    expect(decodeId('rl::p:red')).toBeNull()
    expect(decodeId('rl:abc:p:purple')).toBeNull()
    expect(decodeId('rl:abc:a:fold')).toBeNull()
    expect(decodeId('rl:abc:s:wheel')).toBeNull()
    expect(decodeId('rl:abc:x:red')).toBeNull()
    expect(decodeModalId('rl:g1:p:red')).toBeNull()
    expect(decodeModalId('rlm:g1')).toBeNull()
    expect(decodeModalId('rlm:g1:red:extra')).toBeNull()
    expect(decodeModalId('rlm::red')).toBeNull()
    expect(decodeModalId('rlm:g1:')).toBeNull()
  })

  it('encodes and decodes number select', () => {
    expect(
      decodeId(
        encodeSelectId({ kind: 'select', gameId: 'g1', select: 'number' })
      )
    ).toEqual({ kind: 'select', gameId: 'g1', select: 'number' })

    expect(
      decodeId(
        encodeSelectId({ kind: 'select', gameId: 'g1', select: 'numberHigh' })
      )
    ).toEqual({ kind: 'select', gameId: 'g1', select: 'numberHigh' })
  })
})
