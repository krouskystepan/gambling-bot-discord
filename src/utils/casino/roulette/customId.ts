export const ROULETTE_MAX_SLIP_BETS = 8

export const ROULETTE_OUTSIDE_TARGETS = [
  'red',
  'black',
  'odd',
  'even',
  'low',
  'high'
] as const

export type RouletteOutsideTarget = (typeof ROULETTE_OUTSIDE_TARGETS)[number]

export type RouletteTableAction =
  | 'spin'
  | 'rebet'
  | 'undo'
  | 'clear'
  | 'close'
  | 'change'

export type RouletteSelectKind = 'group' | 'number'

export type RoulettePlaceButtonId = {
  kind: 'place'
  gameId: string
  target: RouletteOutsideTarget
}

export type RouletteActionButtonId = {
  kind: 'action'
  gameId: string
  action: RouletteTableAction
}

export type RouletteSelectId = {
  kind: 'select'
  gameId: string
  select: RouletteSelectKind
}

export type RouletteButtonId =
  | RoulettePlaceButtonId
  | RouletteActionButtonId
  | RouletteSelectId

export type RouletteModalId = {
  gameId: string
  target: string
}

const ACTIONS = new Set<RouletteTableAction>([
  'spin',
  'rebet',
  'undo',
  'clear',
  'close',
  'change'
])

const SELECTS = new Set<RouletteSelectKind>(['group', 'number'])
const OUTSIDES = new Set<string>(ROULETTE_OUTSIDE_TARGETS)

export const encodePlaceId = (d: RoulettePlaceButtonId): string =>
  `rl:${d.gameId}:p:${d.target}`

export const encodeActionId = (d: RouletteActionButtonId): string =>
  `rl:${d.gameId}:a:${d.action}`

export const encodeSelectId = (d: RouletteSelectId): string =>
  `rl:${d.gameId}:s:${d.select}`

export const encodeModalId = (d: RouletteModalId): string =>
  `rlm:${d.gameId}:${d.target}`

export const decodeId = (id: string): RouletteButtonId | null => {
  if (!id.startsWith('rl:')) return null

  const parts = id.split(':')
  if (parts.length !== 4) return null

  const [, gameId, kind, value] = parts
  if (!gameId || !kind || !value) return null

  if (kind === 'p') {
    if (!OUTSIDES.has(value)) return null
    return {
      kind: 'place',
      gameId,
      target: value as RouletteOutsideTarget
    }
  }

  if (kind === 'a') {
    if (!ACTIONS.has(value as RouletteTableAction)) return null
    return {
      kind: 'action',
      gameId,
      action: value as RouletteTableAction
    }
  }

  if (kind === 's') {
    if (!SELECTS.has(value as RouletteSelectKind)) return null
    return {
      kind: 'select',
      gameId,
      select: value as RouletteSelectKind
    }
  }

  return null
}

export const decodeModalId = (id: string): RouletteModalId | null => {
  if (!id.startsWith('rlm:')) return null

  const parts = id.split(':')
  if (parts.length !== 3) return null

  const [, gameId, target] = parts
  if (!gameId || !target) return null

  return { gameId, target }
}
