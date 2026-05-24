import { describe, expect, it } from 'vitest'

import { getRouletteHelpers } from '@/utils/casino/roulette/helpers'

describe('getRouletteHelpers', () => {
  it('documents numbers, colors, parity, ranges, columns, and dozens', () => {
    const text = getRouletteHelpers()

    expect(text).toContain('**Numbers:**')
    expect(text).toContain('**Colors:**')
    expect(text).toContain('red / black')
    expect(text).toContain('**Columns:**')
    expect(text).toContain('C1')
    expect(text).toContain('**Dozens:**')
    expect(text).toContain('D1')
  })
})
