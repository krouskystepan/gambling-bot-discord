export type MinesCellAction = { kind: 'cell'; cellIndex: number }
export type MinesCashOutAction = { kind: 'cashout' }
export type MinesButtonAction = MinesCellAction | MinesCashOutAction

export type MinesButtonId = {
  betId: string
  action: MinesButtonAction
  showBalance: boolean
}

/** `mines:{betId}:cell:{i}:{show}` or `mines:{betId}:CASHOUT:{show}` */
export const encodeId = (d: MinesButtonId): string => {
  const show = d.showBalance ? 1 : 0
  if (d.action.kind === 'cashout') {
    return `mines:${d.betId}:CASHOUT:${show}`
  }
  return `mines:${d.betId}:cell:${d.action.cellIndex}:${show}`
}

export const decodeId = (id: string): MinesButtonId | null => {
  if (!id.startsWith('mines:')) return null

  const parts = id.split(':')
  if (parts.length < 4) return null

  const [, betId, actionRaw, third, fourth] = parts

  if (actionRaw === 'CASHOUT') {
    if (parts.length !== 4) return null
    return {
      betId,
      action: { kind: 'cashout' },
      showBalance: third === '1'
    }
  }

  if (actionRaw === 'cell') {
    if (parts.length !== 5) return null
    const cellIndex = Number(third)
    if (!Number.isInteger(cellIndex)) return null
    return {
      betId,
      action: { kind: 'cell', cellIndex },
      showBalance: fourth === '1'
    }
  }

  return null
}
