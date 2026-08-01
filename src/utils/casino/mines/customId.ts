export type MinesCellAction = { kind: 'cell'; cellIndex: number }
export type MinesCashOutAction = { kind: 'cashout' }
export type MinesTableAction = {
  kind: 'action'
  action: 'rebet' | 'change' | 'close'
}
export type MinesButtonAction =
  | MinesCellAction
  | MinesCashOutAction
  | MinesTableAction

export type MinesButtonId = {
  gameId: string
  action: MinesButtonAction
  showBalance: boolean
}

export type MinesModalId = {
  gameId: string
}

const TABLE_ACTIONS = new Set(['rebet', 'change', 'close'])

/**
 * `mines:{gameId}:cell:{i}:{show}`, `mines:{gameId}:CASHOUT:{show}` or
 * `mines:{gameId}:a:{action}:{show}`
 */
export const encodeId = (d: MinesButtonId): string => {
  const show = d.showBalance ? 1 : 0
  if (d.action.kind === 'cashout') {
    return `mines:${d.gameId}:CASHOUT:${show}`
  }
  if (d.action.kind === 'action') {
    return `mines:${d.gameId}:a:${d.action.action}:${show}`
  }
  return `mines:${d.gameId}:cell:${d.action.cellIndex}:${show}`
}

export const decodeId = (id: string): MinesButtonId | null => {
  if (!id.startsWith('mines:')) return null

  const parts = id.split(':')
  if (parts.length < 4) return null

  const [, gameId, actionRaw, third, fourth] = parts

  if (actionRaw === 'CASHOUT') {
    if (parts.length !== 4) return null
    return {
      gameId,
      action: { kind: 'cashout' },
      showBalance: third === '1'
    }
  }

  if (actionRaw === 'cell') {
    if (parts.length !== 5) return null
    const cellIndex = Number(third)
    if (!Number.isInteger(cellIndex)) return null
    return {
      gameId,
      action: { kind: 'cell', cellIndex },
      showBalance: fourth === '1'
    }
  }

  if (actionRaw === 'a') {
    if (parts.length !== 5) return null
    if (!third || !TABLE_ACTIONS.has(third)) return null
    return {
      gameId,
      action: {
        kind: 'action',
        action: third as MinesTableAction['action']
      },
      showBalance: fourth === '1'
    }
  }

  return null
}

export const encodeModalId = (d: MinesModalId): string => `minesm:${d.gameId}`

export const decodeModalId = (id: string): MinesModalId | null => {
  if (!id.startsWith('minesm:')) return null

  const parts = id.split(':')
  if (parts.length !== 2) return null

  const [, gameId] = parts
  if (!gameId) return null

  return { gameId }
}
