import { describe, expect, it } from 'vitest'

import {
  decodeId,
  decodeModalId,
  encodeId,
  encodeModalId
} from '@/utils/casino/blackjack/customId'

describe('blackjack customId', () => {
  it('round-trips encode and decode', () => {
    const payload = {
      gameId: 'game-abc',
      action: 'DOUBLE' as const,
      showBalance: true
    }

    const id = encodeId(payload)
    expect(id).toBe('bj:game-abc:DOUBLE:1')
    expect(decodeId(id)).toEqual(payload)
  })

  it('decodes showBalance false', () => {
    expect(
      decodeId(encodeId({ gameId: 'x', action: 'STAND', showBalance: false }))
    ).toMatchObject({ showBalance: false })
  })

  it('round-trips session actions', () => {
    for (const action of ['REBET', 'CHANGE', 'CLOSE'] as const) {
      expect(
        decodeId(encodeId({ gameId: 'g1', action, showBalance: true }))
      ).toEqual({ gameId: 'g1', action, showBalance: true })
    }
  })

  it('returns null for invalid ids', () => {
    expect(decodeId('not-bj')).toBeNull()
    expect(decodeId('bj:only:three')).toBeNull()
    expect(decodeId('bj::HIT:1')).toBeNull()
    expect(decodeId('bj:game::1')).toBeNull()
    expect(decodeId('bj:game:INVALID:1')).toBeNull()
  })

  it('round-trips the bet modal id', () => {
    expect(decodeModalId(encodeModalId({ gameId: 'g1' }))).toEqual({
      gameId: 'g1'
    })
  })

  it('returns null for invalid modal ids', () => {
    expect(decodeModalId('bj:g1')).toBeNull()
    expect(decodeModalId('bjm:g1:extra')).toBeNull()
    expect(decodeModalId('bjm:')).toBeNull()
  })
})
