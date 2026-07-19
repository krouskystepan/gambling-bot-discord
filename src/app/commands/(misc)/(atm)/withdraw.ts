import { formatMoney } from 'gambling-bot-shared/common'

import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { AutocompleteCommand, ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  assertGlobalFeature,
  checkAtmChannels,
  checkUserRegistration,
  createAtmCancelSubcommand,
  createAtmRequestSubcommandOptions,
  createAtmStatusSubcommand,
  handleAtmCancelSubcommand,
  handleAtmStatusSubcommand,
  parseAtmAmount,
  previewWithdraw,
  respondAtmRequestCancelAutocomplete,
  respondAtmRequestStatusAutocomplete,
  submitAtmRequest
} from '@/services'
import { createErrorEmbed } from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'withdraw',
  description: 'Withdraw money from your account.',
  options: [
    {
      name: 'request',
      description: 'Request a withdrawal from your account.',
      type: ApplicationCommandOptionType.Subcommand,
      options: createAtmRequestSubcommandOptions('withdraw')
    },
    createAtmStatusSubcommand('withdraw'),
    createAtmCancelSubcommand('withdraw')
  ],
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const subcommand = interaction.options.getSubcommand()

    if (subcommand === 'status') {
      return handleAtmStatusSubcommand(interaction, 'withdraw')
    }

    if (subcommand === 'cancel') {
      return handleAtmCancelSubcommand(interaction, 'withdraw')
    }

    const user = await checkUserRegistration({ interaction })
    if (!user) return

    const guildConfiguration = await checkAtmChannels(interaction)
    if (!guildConfiguration) return
    if (
      !(await assertGlobalFeature(interaction, guildConfiguration, 'withdraw'))
    ) {
      return
    }

    const account = interaction.options.getString('account', true)
    const amount = interaction.options.getString('amount', true)
    const parsed = parseAtmAmount(amount)

    if (!parsed.ok) {
      return interaction.reply({
        embeds: [parsed.embed],
        flags: MessageFlags.Ephemeral
      })
    }

    const preview = await previewWithdraw({
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      amount: parsed.amount
    })

    if (!preview.ok) {
      if (preview.reason === 'INSUFFICIENT_BALANCE') {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Insufficient Funds',
              `You don't have enough funds to withdraw **${formatMoney(parsed.amount, guildConfiguration.globalSettings)}**.\nYour current balance is **${formatMoney(preview.balance, guildConfiguration.globalSettings)}**.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      if (preview.reason === 'INSUFFICIENT_WITHDRAWABLE') {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Insufficient Withdrawable Funds',
              `You requested **${formatMoney(parsed.amount, guildConfiguration.globalSettings)}**, but you can only withdraw **${formatMoney(preview.withdrawable, guildConfiguration.globalSettings)}**.\n` +
                `**${formatMoney(preview.locked, guildConfiguration.globalSettings)}** is currently locked.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'Unable to process withdrawal.')],
        flags: MessageFlags.Ephemeral
      })
    }

    const submitted = await submitAtmRequest({
      interaction,
      type: 'withdraw',
      amount: parsed.amount,
      account,
      guildConfiguration
    })

    if (!submitted.ok) return

    return interaction.reply({
      embeds: [submitted.playerEmbed],
      flags: MessageFlags.Ephemeral
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}

export const autocomplete: AutocompleteCommand = async ({ interaction }) => {
  if (!interaction.isAutocomplete()) return
  if (interaction.commandName !== 'withdraw') return
  const subcommand = interaction.options.getSubcommand()
  if (subcommand === 'status') {
    return respondAtmRequestStatusAutocomplete(interaction, 'withdraw')
  }
  if (subcommand === 'cancel') {
    return respondAtmRequestCancelAutocomplete(interaction, 'withdraw')
  }
}
