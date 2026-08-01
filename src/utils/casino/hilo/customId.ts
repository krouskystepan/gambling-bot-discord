import type { HiloGuess } from 'gambling-bot-shared/casino'

export type HiloButtonData = {
  gameId: string
  guess: HiloGuess
}

export const encodeHiloId = ({ gameId, guess }: HiloButtonData) =>
  `hl:${gameId}:${guess}`

const isHiloGuess = (value: string): value is HiloGuess =>
  value === 'higher' || value === 'lower' || value === 'same'

export const decodeHiloId = (customId: string): HiloButtonData | null => {
  const parts = customId.split(':')
  if (parts.length !== 3 || parts[0] !== 'hl') return null
  const [, gameId, guess] = parts
  if (!gameId || !guess || !isHiloGuess(guess)) return null
  return { gameId, guess }
}
