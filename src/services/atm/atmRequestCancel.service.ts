import { TAtmRequest } from 'gambling-bot-shared/atm'
import { formatMoney } from 'gambling-bot-shared/common'

import { MessageFlags } from 'discord.js'

import { AutocompleteCommand, ChatInputCommand } from 'commandkit'

import { checkUserRegistration, getGuildConfigByGuildId } from '@/services'
import {
  getLatestUserPendingAtmRequest,
  getUserAtmRequest,
  searchUserPendingAtmRequestsForAutocomplete
} from '@/services/db/atmRequest.db'
import { formatDate } from '@/utils/common/utils'
import {
  createErrorEmbed,
  createInfoEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'

import { cancelUserAtmRequest } from './cancelAtmRequest.service'

type CancelInteraction = Parameters<ChatInputCommand>[0]['interaction']
type CancelAutocompleteInteraction =
  Parameters<AutocompleteCommand>[0]['interaction']

const ATM_CANCEL_COPY = {
  withdraw: {
    notFoundTitle: 'Request Not Found',
    notFoundDescription:
      'That withdrawal request was not found or does not belong to you.',
    emptyTitle: 'No Pending Withdrawals',
    emptyDescription: 'You have no pending withdrawal requests to cancel.',
    notPendingTitle: 'Request Not Pending',
    notPendingDescription:
      'That withdrawal request is no longer pending and cannot be cancelled.',
    raceTitle: 'Already Handled',
    raceDescription:
      'That withdrawal request was already handled by staff or cancelled.',
    autocompleteEmpty: 'No pending withdrawal requests found',
    successTitle: 'ATM - Withdrawal Cancelled',
    successDescription: (amount: string) =>
      `Your pending withdrawal of **${amount}** has been cancelled.`
  },
  deposit: {
    notFoundTitle: 'Request Not Found',
    notFoundDescription:
      'That deposit request was not found or does not belong to you.',
    emptyTitle: 'No Pending Deposits',
    emptyDescription: 'You have no pending deposit requests to cancel.',
    notPendingTitle: 'Request Not Pending',
    notPendingDescription:
      'That deposit request is no longer pending and cannot be cancelled.',
    raceTitle: 'Already Handled',
    raceDescription:
      'That deposit request was already handled by staff or cancelled.',
    autocompleteEmpty: 'No pending deposit requests found',
    successTitle: 'ATM - Deposit Cancelled',
    successDescription: (amount: string) =>
      `Your pending deposit of **${amount}** has been cancelled.`
  }
} as const

export const handleAtmCancelSubcommand = async (
  interaction: CancelInteraction,
  type: TAtmRequest['type']
) => {
  const copy = ATM_CANCEL_COPY[type]
  const user = await checkUserRegistration({ interaction })
  if (!user) return

  const guildConfig = await getGuildConfigByGuildId({
    guildId: interaction.guildId!
  })
  const globalSettings = guildConfig?.globalSettings
  const requestIdOption = interaction.options.getString('request')

  let request: TAtmRequest | null = null

  if (requestIdOption && requestIdOption !== 'none') {
    request = await getUserAtmRequest({
      requestId: requestIdOption,
      guildId: interaction.guildId!,
      userId: interaction.user.id,
      type
    })

    if (!request) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(copy.notFoundTitle, copy.notFoundDescription)
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (request.status !== 'pending') {
      return interaction.reply({
        embeds: [
          createErrorEmbed(copy.notPendingTitle, copy.notPendingDescription)
        ],
        flags: MessageFlags.Ephemeral
      })
    }
  } else if (!requestIdOption) {
    request = await getLatestUserPendingAtmRequest({
      guildId: interaction.guildId!,
      userId: interaction.user.id,
      type
    })

    if (!request) {
      return interaction.reply({
        embeds: [createInfoEmbed(copy.emptyTitle, copy.emptyDescription)],
        flags: MessageFlags.Ephemeral
      })
    }
  } else {
    return interaction.reply({
      embeds: [createInfoEmbed(copy.emptyTitle, copy.emptyDescription)],
      flags: MessageFlags.Ephemeral
    })
  }

  const result = await cancelUserAtmRequest({
    requestId: request.requestId,
    guildId: interaction.guildId!,
    userId: interaction.user.id,
    type,
    client: interaction.client
  })

  if (!result.ok) {
    if (result.code === 'NOT_PENDING' || result.code === 'NOT_FOUND') {
      return interaction.reply({
        embeds: [
          createErrorEmbed(copy.notPendingTitle, copy.notPendingDescription)
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    return interaction.reply({
      embeds: [createErrorEmbed(copy.raceTitle, copy.raceDescription)],
      flags: MessageFlags.Ephemeral
    })
  }

  const readableAmount = formatMoney(result.request.amount, globalSettings)

  return interaction.reply({
    embeds: [
      createSuccessEmbed(
        copy.successTitle,
        copy.successDescription(readableAmount)
      )
    ],
    flags: MessageFlags.Ephemeral
  })
}

export const respondAtmRequestCancelAutocomplete = async (
  interaction: CancelAutocompleteInteraction,
  type: TAtmRequest['type']
) => {
  const focused = interaction.options.getFocused(true)
  if (focused.name !== 'request') return

  const guildId = interaction.guildId!
  const copy = ATM_CANCEL_COPY[type]
  const [requests, guildConfig] = await Promise.all([
    searchUserPendingAtmRequestsForAutocomplete({
      guildId,
      userId: interaction.user.id,
      type,
      query: focused.value
    }),
    getGuildConfigByGuildId({ guildId })
  ])
  const globalSettings = guildConfig?.globalSettings

  if (requests.length === 0) {
    return interaction.respond([
      { name: copy.autocompleteEmpty, value: 'none' }
    ])
  }

  return interaction.respond(
    requests.map((request) => ({
      name: `${formatMoney(request.amount, globalSettings)} • ${formatDate(request.createdAt)} • ${request.account}`.slice(
        0,
        100
      ),
      value: request.requestId
    }))
  )
}
