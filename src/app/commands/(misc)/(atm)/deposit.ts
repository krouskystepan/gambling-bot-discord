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
  respondAtmRequestCancelAutocomplete,
  respondAtmRequestStatusAutocomplete,
  submitAtmRequest
} from '@/services'

export const command: CommandData = {
  name: 'deposit',
  description: 'Deposit money to your account.',
  options: [
    {
      name: 'request',
      description: 'Request a deposit to your account.',
      type: ApplicationCommandOptionType.Subcommand,
      options: createAtmRequestSubcommandOptions('deposit')
    },
    createAtmStatusSubcommand('deposit'),
    createAtmCancelSubcommand('deposit')
  ],
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const subcommand = interaction.options.getSubcommand()

    if (subcommand === 'status') {
      return handleAtmStatusSubcommand(interaction, 'deposit')
    }

    if (subcommand === 'cancel') {
      return handleAtmCancelSubcommand(interaction, 'deposit')
    }

    const user = await checkUserRegistration({ interaction })
    if (!user) return

    const guildConfiguration = await checkAtmChannels(interaction)
    if (!guildConfiguration) return
    if (
      !(await assertGlobalFeature(interaction, guildConfiguration, 'deposit'))
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

    const submitted = await submitAtmRequest({
      interaction,
      type: 'deposit',
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
  if (interaction.commandName !== 'deposit') return
  const subcommand = interaction.options.getSubcommand()
  if (subcommand === 'status') {
    return respondAtmRequestStatusAutocomplete(interaction, 'deposit')
  }
  if (subcommand === 'cancel') {
    return respondAtmRequestCancelAutocomplete(interaction, 'deposit')
  }
}
