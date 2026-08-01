import type {
  Card,
  GamePhase,
  TBlackjackHand
} from 'gambling-bot-shared/blackjack'
import type { GlobalSettings } from 'gambling-bot-shared/guild'

export type {
  Card,
  CardLabel,
  GamePhase,
  Suite
} from 'gambling-bot-shared/blackjack'

export type PlayerAction = 'HIT' | 'STAND' | 'DOUBLE' | 'SPLIT'

/** Actions offered between hands while the session sits in `RESULT`. */
export type ResultAction = 'REBET' | 'CHANGE' | 'CLOSE'

export type BlackjackAction = PlayerAction | ResultAction

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

export type EngineState = {
  deck: Card[]
  deckIndex: number
  hands: TBlackjackHand[]
  activeHandIndex: number
  phase: GamePhase
  dealerCards: Card[]
}

export type BlackjackButtonId = {
  gameId: string
  action: BlackjackAction
  showBalance: boolean
}

export type BlackjackModalId = {
  gameId: string
}

export type StartBlackjackResultId = 'PBJ' | 'DBJ' | 'BBJ'

export type GamePhaseId = 'PLAYER_TURN' | 'DEALER_DRAWING'

export type FinalGameResultId = 'WIN' | 'LOSS' | 'EVEN'

export type RenderResult =
  | {
      kind: 'START'
      startResultId: StartBlackjackResultId
      payout: number
    }
  | { kind: 'PHASE'; gamePhaseId: GamePhaseId }
  | { kind: 'FINAL'; finalResultId: FinalGameResultId; netProfit: number }

export type RenderParams = {
  userId: string
  guildId: string
  gameId: string
  hands: TBlackjackHand[]
  activeHandIndex: number
  dealerCards: Card[]
  showBalance: boolean
  userBalance?: number
  dealerHideSecondCard?: boolean
  result?: RenderResult
  globalSettings?: Partial<GlobalSettings> | null
}
