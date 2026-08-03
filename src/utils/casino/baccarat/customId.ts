import {
  type BaccaratBetSide,
  isValidBaccaratBetSide
} from 'gambling-bot-shared/casino'

export type BaccaratTableAction =
  | 'deal'
  | 'rebet'
  | 'undo'
  | 'clear'
  | 'close'
  | 'change'

export type BaccaratPlaceButtonId = {
  kind: 'place'
  gameId: string
  side: BaccaratBetSide
}

export type BaccaratActionButtonId = {
  kind: 'action'
  gameId: string
  action: BaccaratTableAction
}

export type BaccaratButtonId = BaccaratPlaceButtonId | BaccaratActionButtonId

export type BaccaratModalId = {
  gameId: string
  side: BaccaratBetSide
}

const ACTIONS = new Set<BaccaratTableAction>([
  'deal',
  'rebet',
  'undo',
  'clear',
  'close',
  'change'
])

export const encodePlaceId = (d: BaccaratPlaceButtonId): string =>
  `bc:${d.gameId}:p:${d.side}`

export const encodeActionId = (d: BaccaratActionButtonId): string =>
  `bc:${d.gameId}:a:${d.action}`

export const encodeModalId = (d: BaccaratModalId): string =>
  `bcm:${d.gameId}:${d.side}`

export const decodeId = (id: string): BaccaratButtonId | null => {
  if (!id.startsWith('bc:')) return null

  const parts = id.split(':')
  if (parts.length !== 4) return null

  const [, gameId, kind, value] = parts
  if (!gameId || !kind || !value) return null

  if (kind === 'p') {
    if (!isValidBaccaratBetSide(value)) return null
    return { kind: 'place', gameId, side: value }
  }

  if (kind === 'a') {
    if (!ACTIONS.has(value as BaccaratTableAction)) return null
    return { kind: 'action', gameId, action: value as BaccaratTableAction }
  }

  return null
}

export const decodeModalId = (id: string): BaccaratModalId | null => {
  if (!id.startsWith('bcm:')) return null

  const parts = id.split(':')
  if (parts.length !== 3) return null

  const [, gameId, side] = parts
  if (!gameId || !side || !isValidBaccaratBetSide(side)) return null

  return { gameId, side }
}
