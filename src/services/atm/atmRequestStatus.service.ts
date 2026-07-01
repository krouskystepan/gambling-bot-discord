import { TAtmRequest } from 'gambling-bot-shared/atm'
import { formatMoney } from 'gambling-bot-shared/common'

import { MessageFlags } from 'discord.js'

import { AutocompleteCommand, ChatInputCommand } from 'commandkit'

import { checkUserRegistration, getGuildConfigByGuildId } from '@/services'
import {
  getLatestUserAtmRequest,
  getUserAtmRequest,
  searchUserAtmRequestsForAutocomplete
} from '@/services/db/atmRequest.db'
import { formatDate } from '@/utils/common/utils'
import { createErrorEmbed, createInfoEmbed } from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

import { buildAtmRequestStatusEmbed } from './atmRequestStatusEmbed'

type StatusInteraction = Parameters<ChatInputCommand>[0]['interaction']
type StatusAutocompleteInteraction =
  Parameters<AutocompleteCommand>[0]['interaction']

const ATM_STATUS_COPY = {
  withdraw: {
    notFoundTitle: 'Request Not Found',
    notFoundDescription:
      'That withdrawal request was not found or does not belong to you.',
    emptyTitle: 'No Withdrawals',
    emptyDescription: 'You have no withdrawal requests yet.',
    autocompleteEmpty: 'No withdrawal requests found',
    eventAction: 'atm_withdraw_status_checked',
    logMessage: 'ATM withdrawal status checked'
  },
  deposit: {
    notFoundTitle: 'Request Not Found',
    notFoundDescription:
      'That deposit request was not found or does not belong to you.',
    emptyTitle: 'No Deposits',
    emptyDescription: 'You have no deposit requests yet.',
    autocompleteEmpty: 'No deposit requests found',
    eventAction: 'atm_deposit_status_checked',
    logMessage: 'ATM deposit status checked'
  }
} as const

export const handleAtmStatusSubcommand = async (
  interaction: StatusInteraction,
  type: TAtmRequest['type']
) => {
  const copy = ATM_STATUS_COPY[type]
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
  } else if (!requestIdOption) {
    request = await getLatestUserAtmRequest({
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
      embeds: [createErrorEmbed(copy.notFoundTitle, copy.notFoundDescription)],
      flags: MessageFlags.Ephemeral
    })
  }

  logger.event(
    {
      action: copy.eventAction,
      userId: interaction.user.id,
      requestId: request.requestId,
      status: request.status,
      guildId: interaction.guildId
    },
    copy.logMessage
  )

  return interaction.reply({
    embeds: [buildAtmRequestStatusEmbed(request, globalSettings)],
    flags: MessageFlags.Ephemeral
  })
}

export const respondAtmRequestStatusAutocomplete = async (
  interaction: StatusAutocompleteInteraction,
  type: TAtmRequest['type']
) => {
  const focused = interaction.options.getFocused(true)
  if (focused.name !== 'request') return

  const guildId = interaction.guildId!
  const copy = ATM_STATUS_COPY[type]
  const [requests, guildConfig] = await Promise.all([
    searchUserAtmRequestsForAutocomplete({
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
      name: `${formatMoney(request.amount, globalSettings)} • ${request.status.toUpperCase()} • ${formatDate(request.createdAt)} • ${request.account}`.slice(
        0,
        100
      ),
      value: request.requestId
    }))
  )
}
