import type { HiloGuess } from 'gambling-bot-shared/casino'

export type HiloGuessButtonData = {
  kind: 'guess'
  gameId: string
  guess: HiloGuess
}

export type HiloAction = 'deal' | 'rebet' | 'change' | 'close'

export type HiloActionButtonData = {
  kind: 'action'
  gameId: string
  action: HiloAction
}

export type HiloButtonData = HiloGuessButtonData | HiloActionButtonData

export type HiloModalId = {
  gameId: string
}

const ACTIONS = new Set<HiloAction>(['deal', 'rebet', 'change', 'close'])

const isHiloGuess = (value: string): value is HiloGuess =>
  value === 'higher' || value === 'lower' || value === 'same'

export const encodeGuessId = ({
  gameId,
  guess
}: {
  gameId: string
  guess: HiloGuess
}) => `hl:${gameId}:${guess}`

/** @deprecated use encodeGuessId */
export const encodeHiloId = encodeGuessId

export const encodeActionId = ({
  gameId,
  action
}: {
  gameId: string
  action: HiloAction
}) => `hl:${gameId}:a:${action}`

export const decodeHiloId = (customId: string): HiloButtonData | null => {
  const parts = customId.split(':')
  if (parts[0] !== 'hl' || !parts[1]) return null

  const gameId = parts[1]

  if (parts.length === 4 && parts[2] === 'a') {
    const action = parts[3]
    if (!action || !ACTIONS.has(action as HiloAction)) return null
    return { kind: 'action', gameId, action: action as HiloAction }
  }

  if (parts.length === 3 && parts[2] && isHiloGuess(parts[2])) {
    return { kind: 'guess', gameId, guess: parts[2] }
  }

  return null
}

export const encodeModalId = (d: HiloModalId): string => `hlm:${d.gameId}`

export const decodeModalId = (id: string): HiloModalId | null => {
  if (!id.startsWith('hlm:')) return null
  const parts = id.split(':')
  if (parts.length !== 2 || !parts[1]) return null
  return { gameId: parts[1] }
}
