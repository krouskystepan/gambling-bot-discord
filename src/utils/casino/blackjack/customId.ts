import type { BlackjackButtonId, PlayerAction } from './types'

export const encodeId = (d: BlackjackButtonId): string =>
  `bj:${d.betId}:${d.action}:${d.showBalance ? 1 : 0}`

export const decodeId = (id: string): BlackjackButtonId | null => {
  if (!id.startsWith('bj:')) return null

  const parts = id.split(':')
  if (parts.length !== 4) return null

  const [, betId, actionRaw, showRaw] = parts

  if (
    actionRaw !== 'HIT' &&
    actionRaw !== 'STAND' &&
    actionRaw !== 'DOUBLE' &&
    actionRaw !== 'SPLIT'
  ) {
    return null
  }

  return {
    betId,
    action: actionRaw as PlayerAction,
    showBalance: showRaw === '1'
  }
}
