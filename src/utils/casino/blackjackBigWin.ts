import {
  type BlackjackWinMultipliers,
  shouldAnnounceByMultiplier
} from 'gambling-bot-shared/casino'
import { formatMoney } from 'gambling-bot-shared/common'
import { GlobalSettings } from 'gambling-bot-shared/guild'

import { EngineState, resolveResult } from '@/utils/casino/blackjack'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'

export const collectBlackjackBigWinLines = ({
  engine,
  globalSettings,
  winMultipliers,
  minMultiplier
}: {
  engine: EngineState
  globalSettings: GlobalSettings | undefined
  winMultipliers?: BlackjackWinMultipliers
  minMultiplier: number
}) => {
  const lines: string[] = []

  for (let i = 0; i < engine.hands.length; i++) {
    const hand = engine.hands[i]
    const result = resolveResult(engine, i, winMultipliers)

    if (!hand || !result.finished || result.payout <= 0) continue

    const multiplier = result.payout / hand.betAmount
    if (!shouldAnnounceByMultiplier(multiplier, minMultiplier)) continue

    lines.push(
      formatBigWinLine({
        label: `Hand **${i + 1}**`,
        multiplier: multiplier.toFixed(2),
        payout: formatMoney(result.payout, globalSettings),
        bet: formatMoney(hand.betAmount, globalSettings)
      })
    )
  }

  return lines
}
