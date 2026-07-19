import { ApplicationCommandOptionType } from 'discord.js'

export const betOption = {
  name: 'bet',
  description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
  type: ApplicationCommandOptionType.String,
  required: true
} as const

export const showBalanceOption = {
  name: 'show-balance',
  description: 'Displays the current balance (WARNING: VISIBLE TO EVERYONE)!',
  type: ApplicationCommandOptionType.Boolean,
  required: false
} as const

export const skipAnimationsOption = {
  name: 'skip-animations',
  description: 'Skip game animations for faster results.',
  type: ApplicationCommandOptionType.Boolean,
  required: false
} as const

export const roundCountOption = (
  name: 'spins' | 'balls' | 'entries' | 'rolls' | 'flips',
  max: number,
  description: string
) =>
  ({
    name,
    description,
    type: ApplicationCommandOptionType.Integer,
    required: false,
    choices: Array.from({ length: max }, (_, i) => ({
      name: (i + 1).toString(),
      value: i + 1
    }))
  }) as const
