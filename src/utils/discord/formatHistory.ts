import {
  formatCasinoGameLabel,
  formatMoneyExact,
  formatTransactionTypeLabel
} from 'gambling-bot-shared/common'
import type { GlobalSettings } from 'gambling-bot-shared/guild'
import type { TTransaction } from 'gambling-bot-shared/transactions'

export const HISTORY_TRANSACTION_LIMIT = 15

export const HISTORY_TYPE_FILTER_CHOICES = [
  { name: 'All', value: 'all' },
  { name: 'Bets', value: 'bets' },
  { name: 'Deposits', value: 'deposits' },
  { name: 'Withdrawals', value: 'withdrawals' },
  { name: 'Bonus', value: 'bonus' },
  { name: 'Refunds', value: 'refunds' },
  { name: 'VIP', value: 'vip' }
] as const

export type HistoryTypeFilterChoice =
  (typeof HISTORY_TYPE_FILTER_CHOICES)[number]['value']

const ALL_FINANCIAL_TYPES: TTransaction['type'][] = [
  'deposit',
  'withdraw',
  'bet',
  'win',
  'refund',
  'bonus',
  'vip'
]

const HISTORY_TYPE_FILTER_MAP: Record<
  HistoryTypeFilterChoice,
  TTransaction['type'][]
> = {
  all: ALL_FINANCIAL_TYPES,
  bets: ['bet', 'win'],
  deposits: ['deposit'],
  withdrawals: ['withdraw'],
  bonus: ['bonus'],
  refunds: ['refund'],
  vip: ['vip']
}

const OUTFLOW_TYPES = new Set<TTransaction['type']>(['bet', 'withdraw', 'vip'])

export const resolveHistoryTransactionTypes = (
  filterChoice?: string | null
): TTransaction['type'][] => {
  if (!filterChoice || filterChoice === 'all') {
    return HISTORY_TYPE_FILTER_MAP.all
  }

  return (
    HISTORY_TYPE_FILTER_MAP[filterChoice as HistoryTypeFilterChoice] ??
    HISTORY_TYPE_FILTER_MAP.all
  )
}

export const formatHistoryAmount = (
  type: TTransaction['type'],
  amount: number,
  globalSettings?: Partial<GlobalSettings> | null
): string => {
  if (OUTFLOW_TYPES.has(type)) {
    return formatMoneyExact(-amount, globalSettings)
  }

  return `+${formatMoneyExact(amount, globalSettings)}`
}

export const formatHistoryTransactionLine = (
  transaction: Pick<TTransaction, 'type' | 'amount' | 'createdAt' | 'meta'>,
  globalSettings?: Partial<GlobalSettings> | null
): string => {
  const parts = [formatTransactionTypeLabel(transaction.type)]

  if (typeof transaction.meta?.game === 'string' && transaction.meta.game) {
    parts.push(formatCasinoGameLabel(transaction.meta.game))
  }

  parts.push(
    formatHistoryAmount(transaction.type, transaction.amount, globalSettings)
  )

  const unixSeconds = Math.floor(
    new Date(transaction.createdAt).getTime() / 1000
  )
  parts.push(`<t:${unixSeconds}:R>`)

  return parts.join(' · ')
}
