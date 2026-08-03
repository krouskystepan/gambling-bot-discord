import type {
  BlackjackAction,
  BlackjackButtonId,
  BlackjackModalId
} from './types'

const ACTIONS = new Set<BlackjackAction>([
  'HIT',
  'STAND',
  'DOUBLE',
  'SPLIT',
  'REBET',
  'CHANGE',
  'CLOSE',
  'DEAL',
  'INSURE',
  'NO_INSURE'
])

export const encodeId = (d: BlackjackButtonId): string => {
  const base = `bj:${d.gameId}:${d.action}:${d.showBalance ? 1 : 0}`
  return d.salt != null && d.salt !== '' ? `${base}:${d.salt}` : base
}

export const decodeId = (id: string): BlackjackButtonId | null => {
  if (!id.startsWith('bj:')) return null

  const parts = id.split(':')
  // bj:gameId:action:showBalance[:salt]
  if (parts.length !== 4 && parts.length !== 5) return null

  const [, gameId, actionRaw, showRaw, salt] = parts
  if (!gameId || !actionRaw) return null

  if (!ACTIONS.has(actionRaw as BlackjackAction)) return null

  return {
    gameId,
    action: actionRaw as BlackjackAction,
    showBalance: showRaw === '1',
    ...(salt != null && salt !== '' ? { salt } : {})
  }
}

export const encodeModalId = (d: BlackjackModalId): string => `bjm:${d.gameId}`

export const decodeModalId = (id: string): BlackjackModalId | null => {
  if (!id.startsWith('bjm:')) return null

  const parts = id.split(':')
  if (parts.length !== 2) return null

  const [, gameId] = parts
  if (!gameId) return null

  return { gameId }
}
