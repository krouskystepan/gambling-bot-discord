import { shouldAnnounceByMultiplier } from 'gambling-bot-shared/casino'
import { formatMoney } from 'gambling-bot-shared/common'
import { GlobalSettings } from 'gambling-bot-shared/guild'

import { EngineState, resolveResult } from '@/utils/casino/blackjack'

export const collectBlackjackBigWinLines = ({
  engine,
  globalSettings,
  minMultiplier
}: {
  engine: EngineState
  globalSettings: GlobalSettings | undefined
  minMultiplier: number
}) => {
  const lines: string[] = []

  for (let i = 0; i < engine.hands.length; i++) {
    const hand = engine.hands[i]
    const result = resolveResult(engine, i)

    if (!hand || !result.finished || result.payout <= 0) continue

    const multiplier = result.payout / hand.betAmount
    if (!shouldAnnounceByMultiplier(multiplier, minMultiplier)) continue

    lines.push(
      `Hand **${i + 1}** — **x${multiplier.toFixed(2)}** → **${formatMoney(result.payout, globalSettings)}** (bet **${formatMoney(hand.betAmount, globalSettings)}**)`
    )
  }

  return lines
}
