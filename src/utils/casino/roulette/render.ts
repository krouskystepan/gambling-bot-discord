/** Single-zero reds (1–36). Blacks are the rest; 0 is green. */
const SINGLE_ZERO_REDS = new Set([
  '1',
  '3',
  '5',
  '7',
  '9',
  '12',
  '14',
  '16',
  '18',
  '19',
  '21',
  '23',
  '25',
  '27',
  '30',
  '32',
  '34',
  '36'
])

export function getRouletteColor(number: string) {
  if (number === '0') return '🟢'
  if (SINGLE_ZERO_REDS.has(number)) return '🔴'
  const n = Number(number)
  if (Number.isInteger(n) && n >= 1 && n <= 36) return '⚫'
  return '❓ Unknown'
}
