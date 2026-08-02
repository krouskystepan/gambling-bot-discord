import type {
  PerfectPairsOutcome,
  PlusThreeOutcome,
  TBlackjackHand
} from 'gambling-bot-shared/blackjack'
import {
  type BlackjackPairsMultipliers,
  type BlackjackPlusThreeMultipliers,
  type BlackjackWinMultipliers,
  getBlackjackInsurancePayout,
  getBlackjackPairsPayout,
  getBlackjackPlusThreePayout
} from 'gambling-bot-shared/casino'

export const sumHandBets = (hands: TBlackjackHand[]): number =>
  hands.reduce((sum, hand) => sum + hand.betAmount, 0)

export const blackjackLockedTotal = ({
  hands,
  activePairsBetAmount = null,
  activePlusThreeBetAmount = null,
  insuranceBetAmount = null
}: {
  hands: TBlackjackHand[]
  activePairsBetAmount?: number | null
  activePlusThreeBetAmount?: number | null
  insuranceBetAmount?: number | null
}): number =>
  sumHandBets(hands) +
  (activePairsBetAmount ?? 0) +
  (activePlusThreeBetAmount ?? 0) +
  (insuranceBetAmount ?? 0)

export const computeBlackjackSidePayouts = ({
  activePairsBetAmount,
  pairsOutcome,
  activePlusThreeBetAmount,
  plusThreeOutcome,
  insuranceBetAmount,
  dealerHasBlackjack,
  winMultipliers,
  pairsMultipliers,
  plusThreeMultipliers
}: {
  activePairsBetAmount: number | null | undefined
  pairsOutcome: PerfectPairsOutcome | null | undefined
  activePlusThreeBetAmount: number | null | undefined
  plusThreeOutcome: PlusThreeOutcome | null | undefined
  insuranceBetAmount: number | null | undefined
  dealerHasBlackjack: boolean
  winMultipliers: BlackjackWinMultipliers
  pairsMultipliers: BlackjackPairsMultipliers
  plusThreeMultipliers: BlackjackPlusThreeMultipliers
}): {
  pairsPayout: number
  plusThreePayout: number
  insurancePayout: number
} => {
  const pairsStake = activePairsBetAmount ?? 0
  const pairsPayout =
    pairsStake > 0 && pairsOutcome
      ? getBlackjackPairsPayout(pairsStake, pairsOutcome, pairsMultipliers)
      : 0

  const plusThreeStake = activePlusThreeBetAmount ?? 0
  const plusThreePayout =
    plusThreeStake > 0 && plusThreeOutcome
      ? getBlackjackPlusThreePayout(
          plusThreeStake,
          plusThreeOutcome,
          plusThreeMultipliers
        )
      : 0

  const insurancePayout = getBlackjackInsurancePayout(
    insuranceBetAmount ?? 0,
    dealerHasBlackjack,
    winMultipliers
  )

  return { pairsPayout, plusThreePayout, insurancePayout }
}
