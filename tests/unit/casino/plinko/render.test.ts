import { describe, expect, it } from 'vitest'

import { renderBoardFrame } from '@/utils/casino/plinko/render'
import { buildPlinkoPath } from '@/utils/casino/plinko/path'

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
    const frame = renderBoardFrame(
      2,
      [
        [0, -5],
        [0, 0, 10]
      ],
      1,
      0,
      {
        0: 1,
        1: 2,
        2: 3
      }
    )

    expect(frame).toContain('```')
    expect(frame).not.toMatch(/\n.*●.*\n.*●/)
  })
})
