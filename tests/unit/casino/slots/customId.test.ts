import { describe, expect, it } from 'vitest'

import {
  decodeId,
  decodeModalId,
  encodeActionId,
  encodeModalId,
  encodeSelectId,
  parseSpinsCount
} from '@/utils/casino/slots/customId'
import { slotsBatchTotal } from '@/utils/casino/slots/sessionRender'

describe('slots customId', () => {
  it('encodes and decodes actions', () => {
    expect(
      decodeId(encodeActionId({ kind: 'action', gameId: 'g1', action: 'spin' }))
    ).toEqual({ kind: 'action', gameId: 'g1', action: 'spin' })

    expect(
      decodeId(
        encodeActionId({ kind: 'action', gameId: 'g1', action: 'changeBet' })
      )
    ).toEqual({ kind: 'action', gameId: 'g1', action: 'changeBet' })

    expect(
      decodeId(
        encodeActionId({ kind: 'action', gameId: 'g1', action: 'close' })
      )
    ).toEqual({ kind: 'action', gameId: 'g1', action: 'close' })
  })

  it('encodes and decodes spins select', () => {
    expect(
      decodeId(
        encodeSelectId({ kind: 'select', gameId: 'g1', select: 'spins' })
      )
    ).toEqual({ kind: 'select', gameId: 'g1', select: 'spins' })
  })

  it('encodes and decodes bet modal', () => {
    const encoded = encodeModalId({ gameId: 'g1', target: 'bet' })
    expect(encoded).toBe('slm:g1:bet')
    expect(decodeModalId(encoded)).toEqual({ gameId: 'g1', target: 'bet' })
  })

  it('rejects invalid ids', () => {
    expect(decodeId('rl:abc:a:spin')).toBeNull()
    expect(decodeId('sl:abc:a')).toBeNull()
    expect(decodeId('sl:abc:a:spin:extra')).toBeNull()
    expect(decodeId('sl::a:spin')).toBeNull()
    expect(decodeId('sl:abc:a:fold')).toBeNull()
    expect(decodeId('sl:abc:s:wheel')).toBeNull()
    expect(decodeId('sl:abc:x:spin')).toBeNull()
    expect(decodeModalId('sl:g1:a:spin')).toBeNull()
    expect(decodeModalId('slm:g1')).toBeNull()
    expect(decodeModalId('slm:g1:bet:extra')).toBeNull()
    expect(decodeModalId('slm::bet')).toBeNull()
    expect(decodeModalId('slm:g1:chip')).toBeNull()
  })

  it('parses spins count', () => {
    expect(parseSpinsCount('1')).toBe(1)
    expect(parseSpinsCount('10')).toBe(10)
    expect(parseSpinsCount('0')).toBeNull()
    expect(parseSpinsCount('11')).toBeNull()
    expect(parseSpinsCount('1.5')).toBeNull()
    expect(parseSpinsCount('abc')).toBeNull()
  })
})

describe('slotsBatchTotal', () => {
  it('multiplies unit bet by spins', () => {
    expect(slotsBatchTotal(100, 3)).toBe(300)
    expect(slotsBatchTotal(null, 5)).toBe(0)
    expect(slotsBatchTotal(undefined, 2)).toBe(0)
    expect(slotsBatchTotal(0, 4)).toBe(0)
  })
})
