import { EUROPEAN_NUMBERS } from 'gambling-bot-shared/casino'

export function getRouletteColor(number: string) {
  const color = EUROPEAN_NUMBERS[number]
  if (color === 'green') return '🟢'
  if (color === 'red') return '🔴'
  if (color === 'black') return '⚫'
  return '❓ Unknown'
}
