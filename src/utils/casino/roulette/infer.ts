import { MINI_NUMBERS } from 'gambling-bot-shared'

import { RouletteBetType } from './types'

export function inferTypeFromValue(value: string): RouletteBetType {
  const val = value.toLowerCase()

  if (['red', 'black'].includes(val)) return 'color'
  if (['even', 'odd'].includes(val)) return 'parity'
  if (['low', 'high'].includes(val)) return 'range'
  if (val.startsWith('d') && ['1', '2', '3'].includes(val[1])) return 'dozen'
  if (val.startsWith('c') && ['1', '2', '3'].includes(val[1])) return 'column'
  if (val in MINI_NUMBERS) return 'number'

  throw new Error(`Invalid bet value: ${value}`)
}
