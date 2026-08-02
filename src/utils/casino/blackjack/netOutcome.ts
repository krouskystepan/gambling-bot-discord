import type { FinalGameResultId } from './types'

/** Overall table result from net of main + side bets (not main hand alone). */
export const blackjackFinalResultFromNet = (
  netProfit: number
): FinalGameResultId => {
  if (!Number.isFinite(netProfit) || netProfit === 0) return 'EVEN'
  return netProfit > 0 ? 'WIN' : 'LOSS'
}
