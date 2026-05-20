import type { TBlackjackHand } from '@/models/BlackjackGame'

import type { SUITES, VALUES } from './deck'

export type Suite = (typeof SUITES)[number]
export type CardLabel = (typeof VALUES)[number]['label']

export type Card = {
  suite: Suite
  label: CardLabel
  value: number
}

export type PlayerAction = 'HIT' | 'STAND' | 'DOUBLE' | 'SPLIT'

export type HandResultId = 'PB' | 'DB' | 'PW' | 'DW' | 'PUSH'

export type EngineResult =
  | { finished: false }
  | {
      finished: true
      payout: number
      resultId: HandResultId
    }
  | {
      finished: false
      dealerTurn: true
    }

export type GamePhase = 'PLAYER' | 'DEALER' | 'FINISHED'

export type EngineState = {
  deck: Card[]
  deckIndex: number
  hands: TBlackjackHand[]
  activeHandIndex: number
  phase: GamePhase
  dealerCards: Card[]
}

export type BlackjackButtonId = {
  betId: string
  action: PlayerAction
  showBalance: boolean
}

export type StartBlackjackResultId = 'PBJ' | 'DBJ' | 'BBJ'

export type GamePhaseId = 'PLAYER_TURN' | 'DEALER_DRAWING'

export type FinalGameResultId = 'WIN' | 'LOSS' | 'EVEN'

export type RenderResult =
  | { kind: 'START'; startResultId: StartBlackjackResultId }
  | { kind: 'PHASE'; gamePhaseId: GamePhaseId }
  | { kind: 'FINAL'; finalResultId: FinalGameResultId; netProfit: number }

export type RenderParams = {
  userId: string
  guildId: string
  betId: string
  hands: TBlackjackHand[]
  activeHandIndex: number
  dealerCards: Card[]
  showBalance: boolean
  userBalance?: number
  dealerHideSecondCard?: boolean
  result?: RenderResult
}
