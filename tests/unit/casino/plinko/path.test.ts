import { describe, expect, it } from 'vitest'

import { buildPlinkoPath } from '@/utils/casino/plinko/path'
import {
  dropPlinkoPath,
  renderBoardFrame
} from '@/utils/casino/plinko/helpers'

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

describe('dropPlinkoPath', () => {
  it('returns a path with correct length', () => {
    const path = dropPlinkoPath(4, 0)
    expect(path).toHaveLength(5)
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

  it('renders ball position on later steps', () => {
    const path = buildPlinkoPath(3, () => true)
    const frame = renderBoardFrame(3, [path], 2, 0, { 0: 1, 1: 2, 2: 3, 3: 4 })

    expect(frame).toContain('●')
  })

  it('skips balls not yet spawned and finished paths', () => {
    const path = buildPlinkoPath(2, () => true)
    const frame = renderBoardFrame(2, [path, path], 0, 2, {
      0: 1,
      1: 2,
      2: 3
    })

    expect(frame).toContain('```')
  })

  it('skips ball markers when gap column is out of board bounds', () => {
    const frame = renderBoardFrame(2, [[0, -5], [0, 0, 10]], 1, 0, {
      0: 1,
      1: 2,
      2: 3
    })

    expect(frame).toContain('```')
    expect(frame).not.toMatch(/\n.*●.*\n.*●/)
  })
})
