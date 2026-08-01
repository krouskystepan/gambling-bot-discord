import type { HiloGuess } from 'gambling-bot-shared/casino'

export type HiloButtonData = {
  gameId: string
  guess: HiloGuess
}

export const encodeHiloId = ({ gameId, guess }: HiloButtonData) =>
  `hl:${gameId}:${guess}`

export const decodeHiloId = (customId: string): HiloButtonData | null => {
  const parts = customId.split(':')
  if (parts.length !== 3 || parts[0] !== 'hl') return null
  const [, gameId, guess] = parts
  if (!gameId || (guess !== 'higher' && guess !== 'lower')) return null
  return { gameId, guess }
}
