import { normalizePlinkoBinMultipliers } from 'gambling-bot-shared/casino'
import {
  expandPlinkoBinMultipliers,
  getPlinkoMirrorBin,
  pathIndexToPlinkoBin
} from 'gambling-bot-shared/casino'
import { describe, expect, it } from 'vitest'

describe('plinko bin config', () => {
  it('maps path index to 1-based bins', () => {
    expect(pathIndexToPlinkoBin(0)).toBe(1)
    expect(pathIndexToPlinkoBin(8)).toBe(9)
  })

  it('mirrors outer bins', () => {
    expect(getPlinkoMirrorBin(1)).toBe(9)
    expect(getPlinkoMirrorBin(4)).toBe(6)
    expect(getPlinkoMirrorBin(5)).toBe(5)
  })

  it('expands editable bins to symmetric 1–9 layout', () => {
    expect(
      expandPlinkoBinMultipliers({
        1: 8,
        2: 6,
        3: 1.5,
        4: 0.75,
        5: 0.5
      })
    ).toEqual({
      '1': 8,
      '2': 6,
      '3': 1.5,
      '4': 0.75,
      '5': 0.5,
      '6': 0.75,
      '7': 1.5,
      '8': 6,
      '9': 8
    })
  })

  it('migrates legacy 0-indexed bins to 1–9', () => {
    const normalized = normalizePlinkoBinMultipliers({
      0: 8,
      1: 6,
      2: 1.5,
      3: 0.75,
      4: 0.5,
      5: 0.75,
      6: 1.5,
      7: 6,
      8: 8
    })

    expect(normalized['1']).toBe(8)
    expect(normalized['5']).toBe(0.5)
    expect(normalized['9']).toBe(8)
    expect(normalized['6']).toBe(normalized['4'])
  })
})
