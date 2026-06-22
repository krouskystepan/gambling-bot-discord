import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  type ClearMockDbEntity,
  formatClearMockDbSummary,
  runClearMockDb
} from '@/services/dev/clearMockDb'
import { assertDevAccess, devCommandMetadata } from '@/utils/devAccess'

export const command: CommandData = {
  name: 'clear-mock-db',
  description:
    'Remove mock / operational guild data from the DB (keeps guild config). Dev only.',
  options: [
    {
      name: 'all',
      description:
        'Clear users, transactions, ATM, raffles, predictions, VIP, and blackjack games.',
      type: ApplicationCommandOptionType.Subcommand
    },
    {
      name: 'entity',
      description: 'Clear a single collection.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'target',
          description: 'Which data to remove.',
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: [
            { name: 'Users only', value: 'users' },
            { name: 'Transactions only', value: 'transactions' },
            { name: 'ATM requests only', value: 'atm' },
            { name: 'Raffles only', value: 'raffles' },
            { name: 'Predictions only', value: 'predictions' },
            { name: 'VIP rooms only', value: 'vip' }
          ]
        }
      ]
    }
  ],
  dm_permission: false
}

export const metadata: CommandMetadata = devCommandMetadata

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    if (!(await assertDevAccess(interaction))) return

    if (!interaction.guild) {
      return interaction.reply({
        content: '⚠️ This command must be used in a guild.',
        flags: MessageFlags.Ephemeral
      })
    }

    const subcommand = interaction.options.getSubcommand(true)
    let entity: ClearMockDbEntity = 'all'

    if (subcommand === 'entity') {
      entity = interaction.options.getString(
        'target',
        true
      ) as ClearMockDbEntity
    }

    await interaction.deferReply()

    const summary = await runClearMockDb({
      guildId: interaction.guildId!,
      entity
    })

    const totalRemoved = Object.values(summary.deleted).reduce(
      (sum, n) => sum + n,
      0
    )

    await interaction.editReply({
      content:
        `✅ Cleared mock data (**${entity}**)\n` +
        `🛡️ **Guild configuration preserved**\n` +
        `🗑️ **${totalRemoved.toLocaleString()}** documents removed\n\n` +
        formatClearMockDbSummary(summary)
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
