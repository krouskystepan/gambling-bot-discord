import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  assertManagerOrAdmin,
  checkTargetUserRegistration,
  getGuildConfigByGuildId,
  listUserTransactions
} from '@/services'
import { createErrorEmbed, createInfoEmbed } from '@/utils/discord/createEmbed'
import {
  HISTORY_TRANSACTION_LIMIT,
  HISTORY_TYPE_FILTER_CHOICES,
  formatHistoryTransactionLine,
  resolveHistoryTransactionTypes
} from '@/utils/discord/formatHistory'

export const command: CommandData = {
  name: 'history',
  description: 'Show recent ledger transactions for a player.',
  options: [
    {
      name: 'user',
      description: 'The player whose history to show.',
      type: ApplicationCommandOptionType.User,
      required: true
    },
    {
      name: 'type',
      description: 'Optional transaction type filter.',
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: [...HISTORY_TYPE_FILTER_CHOICES]
    }
  ],
  dm_permission: false
}

export const metadata: CommandMetadata = {
  botPermissions: ['Administrator']
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const guildConfig = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })

    const access = await assertManagerOrAdmin(interaction, guildConfig)
    if (!access.ok) return

    const target = interaction.options.getUser('user', true)

    if (target.bot) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Invalid Input - Bot user',
            'This command cannot target a bot.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const targetUser = await checkTargetUserRegistration({
      interaction,
      targetUserId: target.id
    })
    if (!targetUser) return

    const typeFilter = interaction.options.getString('type')
    const types = resolveHistoryTransactionTypes(typeFilter)

    const transactions = await listUserTransactions({
      guildId: interaction.guildId!,
      userId: target.id,
      types,
      limit: HISTORY_TRANSACTION_LIMIT
    })

    if (transactions.length === 0) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            `History — ${target.username}`,
            'No transactions found.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const description = transactions
      .map((transaction) =>
        formatHistoryTransactionLine(transaction, guildConfig?.globalSettings)
      )
      .join('\n')

    return interaction.reply({
      embeds: [createInfoEmbed(`History — ${target.username}`, description)],
      flags: MessageFlags.Ephemeral
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
