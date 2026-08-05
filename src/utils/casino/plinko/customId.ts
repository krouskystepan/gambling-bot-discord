export const PLINKO_MIN_BALLS = 1
export const PLINKO_MAX_BALLS = 10

export const PLINKO_DROP_BALL_COUNTS = [1, 5, 10] as const
export type PlinkoDropBallCount = (typeof PLINKO_DROP_BALL_COUNTS)[number]

export type PlinkoDropAction = 'drop1' | 'drop5' | 'drop10'
export type PlinkoTableAction = PlinkoDropAction | 'close' | 'changeBet'

/** Legacy button actions still decodeable from older board messages. */
type PlinkoLegacyDropAction = 'drop' | 'rebet'

export type PlinkoSelectKind = 'balls'

export type PlinkoActionButtonId = {
  kind: 'action'
  gameId: string
  action: PlinkoTableAction
}

export type PlinkoSelectId = {
  kind: 'select'
  gameId: string
  select: PlinkoSelectKind
}

export type PlinkoButtonId = PlinkoActionButtonId | PlinkoSelectId

export type PlinkoModalId = {
  gameId: string
  target: 'bet'
}

const ACTIONS = new Set<string>([
  'drop1',
  'drop5',
  'drop10',
  'drop',
  'rebet',
  'close',
  'changeBet'
])
const SELECTS = new Set<PlinkoSelectKind>(['balls'])

const DROP_BALLS: Record<
  PlinkoDropAction | PlinkoLegacyDropAction,
  PlinkoDropBallCount
> = {
  drop1: 1,
  drop5: 5,
  drop10: 10,
  drop: 1,
  rebet: 1
}

export const encodeActionId = (d: PlinkoActionButtonId): string =>
  `pk:${d.gameId}:a:${d.action}`

export const encodeSelectId = (d: PlinkoSelectId): string =>
  `pk:${d.gameId}:s:${d.select}`

export const encodeModalId = (d: PlinkoModalId): string =>
  `pkm:${d.gameId}:${d.target}`

export const decodeId = (id: string): PlinkoButtonId | null => {
  if (!id.startsWith('pk:')) return null

  const parts = id.split(':')
  if (parts.length !== 4) return null

  const [, gameId, kind, value] = parts
  if (!gameId || !kind || !value) return null

  if (kind === 'a') {
    if (!ACTIONS.has(value)) return null

    // Map legacy drop/rebet buttons to drop1 for new boards.
    const action: PlinkoTableAction =
      value === 'drop' || value === 'rebet'
        ? 'drop1'
        : (value as PlinkoTableAction)

    return {
      kind: 'action',
      gameId,
      action
    }
  }

  if (kind === 's') {
    if (!SELECTS.has(value as PlinkoSelectKind)) return null
    return {
      kind: 'select',
      gameId,
      select: value as PlinkoSelectKind
    }
  }

  return null
}

export const decodeModalId = (id: string): PlinkoModalId | null => {
  if (!id.startsWith('pkm:')) return null

  const parts = id.split(':')
  if (parts.length !== 3) return null

  const [, gameId, target] = parts
  if (!gameId || target !== 'bet') return null

  return { gameId, target: 'bet' }
}

export const parseDropBalls = (
  action: PlinkoTableAction | PlinkoLegacyDropAction
): PlinkoDropBallCount | null => {
  if (!(action in DROP_BALLS)) return null
  return DROP_BALLS[action as keyof typeof DROP_BALLS]
}

export const parseBallsCount = (raw: string): number | null => {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < PLINKO_MIN_BALLS || n > PLINKO_MAX_BALLS) {
    return null
  }
  return n
}
