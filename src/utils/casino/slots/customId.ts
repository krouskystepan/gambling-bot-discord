export const SLOTS_MIN_SPINS = 1
export const SLOTS_MAX_SPINS = 10

export type SlotsTableAction = 'spin' | 'close' | 'changeBet'

export type SlotsSelectKind = 'spins'

export type SlotsActionButtonId = {
  kind: 'action'
  gameId: string
  action: SlotsTableAction
}

export type SlotsSelectId = {
  kind: 'select'
  gameId: string
  select: SlotsSelectKind
}

export type SlotsButtonId = SlotsActionButtonId | SlotsSelectId

export type SlotsModalId = {
  gameId: string
  target: 'bet'
}

const ACTIONS = new Set<SlotsTableAction>(['spin', 'close', 'changeBet'])
const SELECTS = new Set<SlotsSelectKind>(['spins'])

export const encodeActionId = (d: SlotsActionButtonId): string =>
  `sl:${d.gameId}:a:${d.action}`

export const encodeSelectId = (d: SlotsSelectId): string =>
  `sl:${d.gameId}:s:${d.select}`

export const encodeModalId = (d: SlotsModalId): string =>
  `slm:${d.gameId}:${d.target}`

export const decodeId = (id: string): SlotsButtonId | null => {
  if (!id.startsWith('sl:')) return null

  const parts = id.split(':')
  if (parts.length !== 4) return null

  const [, gameId, kind, value] = parts
  if (!gameId || !kind || !value) return null

  if (kind === 'a') {
    if (!ACTIONS.has(value as SlotsTableAction)) return null
    return {
      kind: 'action',
      gameId,
      action: value as SlotsTableAction
    }
  }

  if (kind === 's') {
    if (!SELECTS.has(value as SlotsSelectKind)) return null
    return {
      kind: 'select',
      gameId,
      select: value as SlotsSelectKind
    }
  }

  return null
}

export const decodeModalId = (id: string): SlotsModalId | null => {
  if (!id.startsWith('slm:')) return null

  const parts = id.split(':')
  if (parts.length !== 3) return null

  const [, gameId, target] = parts
  if (!gameId || target !== 'bet') return null

  return { gameId, target: 'bet' }
}

export const parseSpinsCount = (raw: string): number | null => {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < SLOTS_MIN_SPINS || n > SLOTS_MAX_SPINS) {
    return null
  }
  return n
}
