import {
  type BaccaratBetSide,
  isValidBaccaratBetSide
} from 'gambling-bot-shared/casino'

export type BaccaratTableAction = 'rebet' | 'change' | 'close' | 'amount'

export type BaccaratSideButtonId = {
  kind: 'side'
  gameId: string
  side: BaccaratBetSide
}

export type BaccaratActionButtonId = {
  kind: 'action'
  gameId: string
  action: BaccaratTableAction
}

export type BaccaratButtonId = BaccaratSideButtonId | BaccaratActionButtonId

export type BaccaratModalId = {
  gameId: string
}

const ACTIONS = new Set<BaccaratTableAction>([
  'rebet',
  'change',
  'close',
  'amount'
])

export const encodeSideId = (d: BaccaratSideButtonId): string =>
  `bc:${d.gameId}:s:${d.side}`

export const encodeActionId = (d: BaccaratActionButtonId): string =>
  `bc:${d.gameId}:a:${d.action}`

export const encodeModalId = (d: BaccaratModalId): string => `bcm:${d.gameId}`

export const decodeId = (id: string): BaccaratButtonId | null => {
  if (!id.startsWith('bc:')) return null

  const parts = id.split(':')
  if (parts.length !== 4) return null

  const [, gameId, kind, value] = parts
  if (!gameId || !kind || !value) return null

  if (kind === 's') {
    if (!isValidBaccaratBetSide(value)) return null
    return { kind: 'side', gameId, side: value }
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
  if (parts.length !== 2) return null

  const [, gameId] = parts
  if (!gameId) return null

  return { gameId }
}
