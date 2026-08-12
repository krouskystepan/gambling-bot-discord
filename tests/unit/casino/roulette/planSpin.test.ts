import { EUROPEAN_NUMBERS } from 'gambling-bot-shared/casino'
import { describe, expect, it } from 'vitest'

import {
  WHEEL_ORDER,
  formatSpinningWheelRow,
  planSpin
} from '@/utils/casino/roulette/playRound'

describe('roulette planSpin', () => {
  it('lands only on European wheel pockets', () => {
    for (let i = 0; i < 200; i++) {
      const { centers, result } = planSpin()
      expect(result in EUROPEAN_NUMBERS).toBe(true)
      expect(WHEEL_ORDER).toContain(result)
      for (const center of centers) {
        const pocket = WHEEL_ORDER[center]
        expect(pocket).toBeDefined()
        expect(pocket! in EUROPEAN_NUMBERS).toBe(true)
      }
    }
  })

  it('includes high European numbers on the wheel', () => {
    expect(WHEEL_ORDER).toContain('32')
    expect(WHEEL_ORDER).toHaveLength(37)
    expect(new Set(WHEEL_ORDER).size).toBe(37)
  })

  it('formats a three-pocket spinning window', () => {
    const row = formatSpinningWheelRow(1)
    expect(row).toContain('↓')
    expect(row).toContain('32')
  })
})
