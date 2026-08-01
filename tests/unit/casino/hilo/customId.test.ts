import { describe, expect, it } from 'vitest'

import { decodeHiloId, encodeHiloId } from '@/utils/casino/hilo/customId'

describe('hilo customId', () => {
  it('encodes and decodes higher/lower guesses', () => {
    expect(encodeHiloId({ gameId: 'hilo-ABC', guess: 'higher' })).toBe(
      'hl:hilo-ABC:higher'
    )
    expect(decodeHiloId('hl:hilo-ABC:lower')).toEqual({
      gameId: 'hilo-ABC',
      guess: 'lower'
    })
  })

  it('rejects malformed ids', () => {
    expect(decodeHiloId('hl:only-two')).toBeNull()
    expect(decodeHiloId('xx:hilo-ABC:higher')).toBeNull()
    expect(decodeHiloId('hl:hilo-ABC:sideways')).toBeNull()
  })
})
