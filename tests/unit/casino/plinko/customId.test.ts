import { defaultGlobalSettings } from 'gambling-bot-shared/guild'
import { describe, expect, it } from 'vitest'

import {
  decodeId,
  decodeModalId,
  encodeActionId,
  encodeModalId,
  encodeSelectId,
  parseBallsCount,
  parseDropBalls
} from '@/utils/casino/plinko/customId'
import {
  liveNetAtDropStep,
  summarizePlinkoBatch
} from '@/utils/casino/plinko/playRound'
import { plinkoBatchTotal } from '@/utils/casino/plinko/sessionRender'

describe('plinko customId', () => {
  it('encodes and decodes drop x1 / x5 / x10 actions', () => {
    expect(
      decodeId(
        encodeActionId({ kind: 'action', gameId: 'g1', action: 'drop1' })
      )
    ).toEqual({ kind: 'action', gameId: 'g1', action: 'drop1' })

    expect(
      decodeId(
        encodeActionId({ kind: 'action', gameId: 'g1', action: 'drop5' })
      )
    ).toEqual({ kind: 'action', gameId: 'g1', action: 'drop5' })

    expect(
      decodeId(
        encodeActionId({ kind: 'action', gameId: 'g1', action: 'drop10' })
      )
    ).toEqual({ kind: 'action', gameId: 'g1', action: 'drop10' })

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

  it('maps legacy drop/rebet buttons to drop1', () => {
    expect(decodeId('pk:g1:a:drop')).toEqual({
      kind: 'action',
      gameId: 'g1',
      action: 'drop1'
    })
    expect(decodeId('pk:g1:a:rebet')).toEqual({
      kind: 'action',
      gameId: 'g1',
      action: 'drop1'
    })
  })

  it('encodes and decodes balls select', () => {
    expect(
      decodeId(
        encodeSelectId({ kind: 'select', gameId: 'g1', select: 'balls' })
      )
    ).toEqual({ kind: 'select', gameId: 'g1', select: 'balls' })
  })

  it('encodes and decodes bet modal', () => {
    const encoded = encodeModalId({ gameId: 'g1', target: 'bet' })
    expect(encoded).toBe('pkm:g1:bet')
    expect(decodeModalId(encoded)).toEqual({ gameId: 'g1', target: 'bet' })
  })

  it('rejects invalid ids', () => {
    expect(decodeId('sl:abc:a:drop')).toBeNull()
    expect(decodeId('pk:abc:a')).toBeNull()
    expect(decodeId('pk:abc:a:drop:extra')).toBeNull()
    expect(decodeId('pk::a:drop')).toBeNull()
    expect(decodeId('pk:abc:a:spin')).toBeNull()
    expect(decodeId('pk:abc:s:spins')).toBeNull()
    expect(decodeId('pk:abc:x:drop')).toBeNull()
    expect(decodeModalId('pk:g1:a:drop')).toBeNull()
    expect(decodeModalId('pkm:g1')).toBeNull()
    expect(decodeModalId('pkm:g1:bet:extra')).toBeNull()
    expect(decodeModalId('pkm::bet')).toBeNull()
    expect(decodeModalId('pkm:g1:chip')).toBeNull()
  })

  it('parses drop ball counts from actions', () => {
    expect(parseDropBalls('drop1')).toBe(1)
    expect(parseDropBalls('drop5')).toBe(5)
    expect(parseDropBalls('drop10')).toBe(10)
    expect(parseDropBalls('drop')).toBe(1)
    expect(parseDropBalls('rebet')).toBe(1)
    expect(parseDropBalls('close')).toBeNull()
    expect(parseDropBalls('changeBet')).toBeNull()
  })

  it('parses balls count', () => {
    expect(parseBallsCount('1')).toBe(1)
    expect(parseBallsCount('10')).toBe(10)
    expect(parseBallsCount('0')).toBeNull()
    expect(parseBallsCount('11')).toBeNull()
    expect(parseBallsCount('1.5')).toBeNull()
    expect(parseBallsCount('abc')).toBeNull()
  })
})

describe('plinkoBatchTotal', () => {
  it('multiplies unit bet by balls', () => {
    expect(plinkoBatchTotal(100, 3)).toBe(300)
    expect(plinkoBatchTotal(null, 5)).toBe(0)
    expect(plinkoBatchTotal(undefined, 2)).toBe(0)
    expect(plinkoBatchTotal(0, 4)).toBe(0)
  })
})

describe('summarizePlinkoBatch', () => {
  it('settles win / loss / push math from path bins', () => {
    // pathIndex N maps to bin N+1. Editable bins 1-5 expand with mirrors.
    const summary = summarizePlinkoBatch({
      paths: [
        [0, 0, 0],
        [0, 1, 2],
        [0, 0, 4]
      ],
      unitBet: 100,
      binMultipliers: {
        1: 2,
        2: 1,
        3: 0.5,
        4: 0.25,
        5: 0
      },
      announceMinMultiplier: 10,
      globalSettings: defaultGlobalSettings
    })

    // ball0 bin1 x2 -> +100 net, win; ball1 bin3 x0.5 -> -50; ball2 bin5 x0 -> -100
    expect(summary.winsCount).toBe(1)
    expect(summary.totalWinnings).toBe(250)
    expect(summary.liveNet).toBe(-50)
    expect(summary.resultLines).toHaveLength(3)
  })
})

describe('liveNetAtDropStep', () => {
  const binMultipliers = {
    1: 2,
    2: 1,
    3: 0.5,
    4: 0.25,
    5: 0
  }
  const paths = [
    [0, 0, 0],
    [0, 1, 2]
  ]

  it('stays at 0 until a ball reaches its final bin', () => {
    expect(
      liveNetAtDropStep({
        paths,
        globalStep: 0,
        spawnDelay: 2,
        unitBet: 100,
        binMultipliers
      })
    ).toBe(0)

    expect(
      liveNetAtDropStep({
        paths,
        globalStep: 1,
        spawnDelay: 2,
        unitBet: 100,
        binMultipliers
      })
    ).toBe(0)
  })

  it('adds each landed ball net as the drop timeline advances', () => {
    // Ball 0 lands at localStep 2 (path length 3).
    expect(
      liveNetAtDropStep({
        paths,
        globalStep: 2,
        spawnDelay: 2,
        unitBet: 100,
        binMultipliers
      })
    ).toBe(100)

    // Ball 1 starts at step 2, lands at globalStep 4.
    expect(
      liveNetAtDropStep({
        paths,
        globalStep: 4,
        spawnDelay: 2,
        unitBet: 100,
        binMultipliers
      })
    ).toBe(50)
  })
})
