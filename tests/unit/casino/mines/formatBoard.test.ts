import { describe, expect, it } from 'vitest'

import { formatMinesBoard } from '@/utils/casino/mines/render'

describe('formatMinesBoard', () => {
  it('renders mines, reveals, and hidden cells', () => {
    const board = formatMinesBoard({
      betAmount: 100,
      mineCount: 2,
      mineIndices: [0, 1],
      revealedIndices: [2],
      houseEdgeSnapshot: 0.03,
      status: 'RESULT'
    })

    const lines = board.split('\n')
    expect(lines).toHaveLength(4)
    expect(lines[0]).toBe('🟥🟥🟩⬛⬛')
    expect(lines[1]).toBe('⬛⬛⬛⬛⬛')
  })
})
