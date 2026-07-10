import { ApplicationCommandOptionType } from 'discord.js'

export const createAtmRequestSubcommandOptions = (
  type: 'withdraw' | 'deposit'
) => [
  {
    name: 'amount',
    description:
      type === 'withdraw'
        ? 'The amount you want to withdraw (e.g., 1000, 2k, 10.5k).'
        : 'The amount you want to deposit (e.g., 1000, 2k, 10.5k).',
    type: ApplicationCommandOptionType.String as const,
    required: true
  },
  {
    name: 'account',
    description:
      type === 'withdraw'
        ? 'The account you want to send the money to.'
        : 'The account from which you are sending money.',
    type: ApplicationCommandOptionType.String as const,
    required: true
  }
]

export const createAtmStatusSubcommand = (type: 'withdraw' | 'deposit') => ({
  name: 'status',
  description:
    type === 'withdraw'
      ? 'Check the status of your withdrawal requests.'
      : 'Check the status of your deposit requests.',
  type: ApplicationCommandOptionType.Subcommand as const,
  options: [
    {
      name: 'request',
      description:
        type === 'withdraw'
          ? 'Withdrawal request to check (defaults to your latest)'
          : 'Deposit request to check (defaults to your latest)',
      type: ApplicationCommandOptionType.String as const,
      required: false,
      autocomplete: true
    }
  ]
})

export const createAtmCancelSubcommand = (type: 'withdraw' | 'deposit') => ({
  name: 'cancel',
  description:
    type === 'withdraw'
      ? 'Cancel one of your pending withdrawal requests.'
      : 'Cancel one of your pending deposit requests.',
  type: ApplicationCommandOptionType.Subcommand as const,
  options: [
    {
      name: 'request',
      description:
        type === 'withdraw'
          ? 'Pending withdrawal to cancel (defaults to your latest pending)'
          : 'Pending deposit to cancel (defaults to your latest pending)',
      type: ApplicationCommandOptionType.String as const,
      required: false,
      autocomplete: true
    }
  ]
})
