import { decodeId, encodeId } from '@/utils/casino/mines/customId'
import { describe, expect, it } from 'vitest'

describe('mines customId', () => {
  it('round-trips cell and cashout ids', () => {
    const cell = encodeId({
      betId: 'abc',
      action: { kind: 'cell', cellIndex: 7 },
      showBalance: true
    })
    expect(cell).toBe('mines:abc:cell:7:1')
    expect(decodeId(cell)).toEqual({
      betId: 'abc',
      action: { kind: 'cell', cellIndex: 7 },
      showBalance: true
    })

    const cash = encodeId({
      betId: 'abc',
      action: { kind: 'cashout' },
      showBalance: false
    })
    expect(cash).toBe('mines:abc:CASHOUT:0')
    expect(decodeId(cash)).toEqual({
      betId: 'abc',
      action: { kind: 'cashout' },
      showBalance: false
    })
  })

  it('rejects invalid ids', () => {
    expect(decodeId('bj:abc:HIT:1')).toBeNull()
    expect(decodeId('mines:abc:cell')).toBeNull()
    expect(decodeId('mines:abc:CASHOUT:1:extra')).toBeNull()
    expect(decodeId('mines:abc:cell:7')).toBeNull()
    expect(decodeId('mines:abc:cell:x:1')).toBeNull()
    expect(decodeId('mines:abc:NOPE:1')).toBeNull()
  })
})
