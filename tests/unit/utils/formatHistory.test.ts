import { describe, expect, it } from 'vitest'

import {
  formatHistoryAmount,
  formatHistoryTransactionLine,
  resolveHistoryTransactionTypes
} from '@/utils/discord/formatHistory'

const globalSettings = {
  currencySymbol: '$',
  currencyPlacement: 'prefix' as const
}

describe('resolveHistoryTransactionTypes', () => {
  it('maps all / omitted to full financial ledger types', () => {
    expect(resolveHistoryTransactionTypes()).toEqual([
      'deposit',
      'withdraw',
      'bet',
      'win',
      'refund',
      'bonus',
      'vip'
    ])
    expect(resolveHistoryTransactionTypes('all')).toEqual([
      'deposit',
      'withdraw',
      'bet',
      'win',
      'refund',
      'bonus',
      'vip'
    ])
  })

  it('maps filter choices to $in type lists', () => {
    expect(resolveHistoryTransactionTypes('bets')).toEqual(['bet', 'win'])
    expect(resolveHistoryTransactionTypes('deposits')).toEqual(['deposit'])
    expect(resolveHistoryTransactionTypes('withdrawals')).toEqual(['withdraw'])
    expect(resolveHistoryTransactionTypes('bonus')).toEqual(['bonus'])
    expect(resolveHistoryTransactionTypes('refunds')).toEqual(['refund'])
    expect(resolveHistoryTransactionTypes('vip')).toEqual(['vip'])
  })

  it('falls back to all for unknown choices', () => {
    expect(resolveHistoryTransactionTypes('unknown')).toEqual([
      'deposit',
      'withdraw',
      'bet',
      'win',
      'refund',
      'bonus',
      'vip'
    ])
  })
})

describe('formatHistoryAmount', () => {
  it('formats outflows with minus and inflows with plus', () => {
    expect(formatHistoryAmount('bet', 50, globalSettings)).toBe('-$50')
    expect(formatHistoryAmount('withdraw', 200, globalSettings)).toBe('-$200')
    expect(formatHistoryAmount('vip', 100, globalSettings)).toBe('-$100')
    expect(formatHistoryAmount('win', 120, globalSettings)).toBe('+$120')
    expect(formatHistoryAmount('deposit', 200, globalSettings)).toBe('+$200')
    expect(formatHistoryAmount('bonus', 25, globalSettings)).toBe('+$25')
    expect(formatHistoryAmount('refund', 10, globalSettings)).toBe('+$10')
  })
})

describe('formatHistoryTransactionLine', () => {
  it('formats casino bet/win lines with game and relative time', () => {
    const createdAt = new Date('2024-01-01T00:00:00.000Z')

    expect(
      formatHistoryTransactionLine(
        {
          type: 'bet',
          amount: 50,
          createdAt,
          meta: { game: 'slots' }
        },
        globalSettings
      )
    ).toBe('BET · SLOTS · -$50 · <t:1704067200:R>')

    expect(
      formatHistoryTransactionLine(
        {
          type: 'win',
          amount: 120,
          createdAt,
          meta: { game: 'slots' }
        },
        globalSettings
      )
    ).toBe('WIN · SLOTS · +$120 · <t:1704067200:R>')
  })

  it('omits game when meta.game is missing', () => {
    const createdAt = new Date('2024-01-01T00:00:00.000Z')

    expect(
      formatHistoryTransactionLine(
        {
          type: 'deposit',
          amount: 200,
          createdAt
        },
        globalSettings
      )
    ).toBe('DEPOSIT · +$200 · <t:1704067200:R>')
  })
})
