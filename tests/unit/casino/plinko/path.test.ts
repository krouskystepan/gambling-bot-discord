import { describe, expect, it } from 'vitest'

import { buildPlinkoPath } from '@/utils/casino/plinko/path'
import { renderBoardFrame } from '@/utils/casino/plinko/helpers'

describe('buildPlinkoPath', () => {
  it('stays within row bounds', () => {
    const path = buildPlinkoPath(8, () => true)

    expect(path).toHaveLength(9)
    path.forEach((pos, row) => {
      expect(pos).toBeGreaterThanOrEqual(0)
      expect(pos).toBeLessThanOrEqual(row)
    })
  })

  it('follows deterministic right moves', () => {
    const path = buildPlinkoPath(4, () => true)
    expect(path).toEqual([0, 1, 2, 3, 4])
  })

  it('follows deterministic left moves', () => {
    const path = buildPlinkoPath(4, () => false)
    expect(path).toEqual([0, 0, 0, 0, 0])
  })
})

describe('renderBoardFrame', () => {
  it('renders pegs and legend for a fixed path', () => {
    const path = buildPlinkoPath(3, () => true)
    const frame = renderBoardFrame(3, [path], 0, 0, {
      0: 1,
      1: 2,
      2: 3,
      3: 4
    })

    expect(frame).toContain('```')
    expect(frame).toContain('Legend:')
    expect(frame).toContain('**A**')
  })
})
