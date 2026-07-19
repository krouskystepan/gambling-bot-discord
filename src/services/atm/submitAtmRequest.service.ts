import { TAtmRequest } from 'gambling-bot-shared/atm'
import { formatMoney, generateId } from 'gambling-bot-shared/common'
import { TGuildConfiguration } from 'gambling-bot-shared/guild'

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  GuildTextBasedChannel,
  Message,
  MessageFlags
} from 'discord.js'

import { ChatInputCommand } from 'commandkit'

import {
  attachAtmRequestMessage,
  createAtmRequest,
  deleteAtmRequest
} from '@/services/db/atmRequest.db'
import { isGuildSendableChannel } from '@/utils/discord/channelGuards'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

import {
  ATM_LOG_CHANNEL_MISCONFIGURED_DESCRIPTION,
  ATM_LOG_CHANNEL_MISCONFIGURED_TITLE,
  getAtmRequestCopy
} from './atmRequestCopy'

type SubmitAtmRequestParams = {
  interaction: Parameters<ChatInputCommand>[0]['interaction']
  type: TAtmRequest['type']
  amount: number
  account: string
  guildConfiguration: TGuildConfiguration
}

export type SubmitAtmRequestResult =
  | { ok: true; requestId: string; playerEmbed: EmbedBuilder }
  | { ok: false }

export const submitAtmRequest = async ({
  interaction,
  type,
  amount,
  account,
  guildConfiguration
}: SubmitAtmRequestParams): Promise<SubmitAtmRequestResult> => {
  const copy = getAtmRequestCopy(type)
  const readableAmount = formatMoney(amount, guildConfiguration.globalSettings)

  const logChannel = await interaction
    .guild!.channels.fetch(guildConfiguration.atmChannelIds.logs)
    .catch(() => null)

  if (!isGuildSendableChannel(logChannel)) {
    await interaction.reply({
      embeds: [
        createErrorEmbed(
          ATM_LOG_CHANNEL_MISCONFIGURED_TITLE,
          ATM_LOG_CHANNEL_MISCONFIGURED_DESCRIPTION
        )
      ],
      flags: MessageFlags.Ephemeral
    })
    return { ok: false }
  }

  const sendableLogChannel = logChannel as GuildTextBasedChannel

  const member = interaction.member as GuildMember | null
  const displayName =
    member?.displayName ||
    interaction.user.globalName ||
    interaction.user.username

  const managerRole = guildConfiguration.managerRoleId
  const requestId = generateId()

  await createAtmRequest({
    requestId,
    userId: interaction.user.id,
    guildId: interaction.guildId!,
    type,
    amount,
    account
  })

  let logMessage: Message<true>

  try {
    logMessage = await sendableLogChannel.send({
      content: managerRole ? `<@&${managerRole}>` : '',
      embeds: [
        new EmbedBuilder()
          .setTitle(copy.staffTitle(displayName, interaction.user.username))
          .setColor(copy.staffColor)
          .setDescription(
            copy.staffDescription(interaction.user.id, readableAmount, account)
          )
          .setFooter({ text: `ID: ${requestId}` })
      ]
    })
  } catch (err) {
    await deleteAtmRequest(requestId)
    throw err
  }

  await attachAtmRequestMessage(requestId, sendableLogChannel.id, logMessage.id)

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`atm.approve.${requestId}`)
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`atm.reject.${requestId}`)
      .setLabel('Reject')
      .setStyle(ButtonStyle.Danger)
  )

  await logMessage.edit({ components: [row] })

  logger.event(
    {
      action: copy.loggerAction,
      userId: interaction.user.id,
      requestId,
      amount,
      guildId: interaction.guildId
    },
    copy.loggerMessage
  )

  return {
    ok: true,
    requestId,
    playerEmbed: createSuccessEmbed(
      copy.playerTitle,
      copy.playerDescription(readableAmount),
      requestId
    )
  }
}
