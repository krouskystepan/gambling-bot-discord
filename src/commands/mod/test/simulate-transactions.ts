import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import { ApplicationCommandOptionType } from 'discord.js'
import Transaction, { TransactionDoc } from '../../../models/Transaction'
import {
  formatNumberToReadableString,
  parseReadableStringToNumber,
} from '../../../utils/utils'

export const data: CommandData = {
  name: 'simulate-transactions',
  description: 'Simulate X transactions for testing filtering and indexing.',
  options: [
    {
      name: 'count',
      description: 'Number of transactions to simulate.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'max-amount',
      description: 'Maximum amount per transaction.',
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],
  dm_permission: false,
}

export const options: CommandOptions = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  devOnly: true,
}

const TYPES = [
  'deposit',
  'withdraw',
  'bet',
  'win',
  'refund',
  'bonus',
  'vip',
] as const
const SOURCES = ['command', 'manual', 'web', 'system', 'casino'] as const

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomString(length = 8) {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length)
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    const count = parseReadableStringToNumber(
      interaction.options.getString('count', true)
    )
    const maxAmount = parseReadableStringToNumber(
      interaction.options.getString('max-amount') || '1000'
    )

    if (count > 100_000) {
      return interaction.reply({
        content: 'Max 100,000 transactions at once.',
      })
    }

    await interaction.deferReply()

    const transactions: Partial<TransactionDoc>[] = []

    for (let i = 0; i < count; i++) {
      transactions.push({
        userId: randomString(8),
        guildId: interaction.guildId!,
        amount: Math.floor(Math.random() * maxAmount) + 1,
        type: randomChoice(TYPES),
        source: randomChoice(SOURCES),
        betId: Math.random() < 0.5 ? randomString(6) : undefined,
        handledBy: Math.random() < 0.3 ? randomString(6) : undefined,
        createdAt: new Date(
          Date.now() - Math.floor(Math.random() * 1_000_000_000)
        ),
      })
    }

    await Transaction.insertMany(transactions)

    await interaction.editReply({
      content: `✅ Successfully simulated ${formatNumberToReadableString(
        count
      )} transactions!`,
    })
  } catch (error) {
    console.error('Error simulating transactions:', error)
    interaction.editReply({
      content: '❌ Something went wrong while simulating transactions.',
    })
  }
}
