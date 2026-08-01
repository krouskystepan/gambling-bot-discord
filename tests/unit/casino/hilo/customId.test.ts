import { describe, expect, it } from 'vitest'

import {
  decodeHiloId,
  decodeModalId,
  encodeActionId,
  encodeGuessId,
  encodeHiloId,
  encodeModalId
} from '@/utils/casino/hilo/customId'

describe('hilo customId', () => {
  it('encodes and decodes higher/lower/same guesses', () => {
    expect(encodeHiloId({ gameId: 'hilo-ABC', guess: 'higher' })).toBe(
      'hl:hilo-ABC:higher'
    )
    expect(decodeHiloId('hl:hilo-ABC:lower')).toEqual({
      kind: 'guess',
      gameId: 'hilo-ABC',
      guess: 'lower'
    })
    expect(decodeHiloId('hl:hilo-ABC:same')).toEqual({
      kind: 'guess',
      gameId: 'hilo-ABC',
      guess: 'same'
    })
    expect(encodeGuessId({ gameId: 'hilo-ABC', guess: 'higher' })).toBe(
      'hl:hilo-ABC:higher'
    )
  })

  it('encodes and decodes session actions', () => {
    expect(encodeActionId({ gameId: 'hilo-ABC', action: 'deal' })).toBe(
      'hl:hilo-ABC:a:deal'
    )
    expect(decodeHiloId('hl:hilo-ABC:a:rebet')).toEqual({
      kind: 'action',
      gameId: 'hilo-ABC',
      action: 'rebet'
    })
    expect(decodeHiloId('hl:hilo-ABC:a:change')).toEqual({
      kind: 'action',
      gameId: 'hilo-ABC',
      action: 'change'
    })
    expect(decodeHiloId('hl:hilo-ABC:a:close')).toEqual({
      kind: 'action',
      gameId: 'hilo-ABC',
      action: 'close'
    })
  })

  it('encodes and decodes bet modals', () => {
    expect(encodeModalId({ gameId: 'hilo-ABC' })).toBe('hlm:hilo-ABC')
    expect(decodeModalId('hlm:hilo-ABC')).toEqual({ gameId: 'hilo-ABC' })
    expect(decodeModalId('hlm:')).toBeNull()
    expect(decodeModalId('xx:hilo-ABC')).toBeNull()
  })

  it('rejects malformed ids', () => {
    expect(decodeHiloId('hl:only-two')).toBeNull()
    expect(decodeHiloId('xx:hilo-ABC:higher')).toBeNull()
    expect(decodeHiloId('hl:hilo-ABC:sideways')).toBeNull()
    expect(decodeHiloId('hl:hilo-ABC:a:spin')).toBeNull()
  })
})
