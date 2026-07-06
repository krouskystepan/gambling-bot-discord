import {
  EmbedBuilder,
  NewsChannel,
  TextChannel,
  ThreadChannel
} from 'discord.js'

import { Client } from 'commandkit'

import { getGuildConfigByGuildId } from '@/services'
import { isGuildSendableChannel } from '@/utils/discord/channelGuards'
import {
  createErrorEmbed,
  createInfoEmbed,
  createSuccessEmbed,
  createWarningEmbed
} from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export type WorkerLogLevel = 'info' | 'success' | 'warning' | 'error'

export type WorkerLogPayload = {
  guildId: string
  worker: string
  title: string
  description: string
  level?: WorkerLogLevel
}

const buildWorkerEmbed = ({
  worker,
  title,
  description,
  level = 'info'
}: Omit<WorkerLogPayload, 'guildId'>): EmbedBuilder => {
  const embedTitle = `${worker} — ${title}`
  const timestamp = Math.floor(Date.now() / 1000)
  const footer = `${worker} • <t:${timestamp}:F>`

  switch (level) {
    case 'success':
      return createSuccessEmbed(embedTitle, description).setFooter({
        text: footer
      })
    case 'warning':
      return createWarningEmbed(embedTitle, description).setFooter({
        text: footer
      })
    case 'error':
      return createErrorEmbed(embedTitle, description).setFooter({
        text: footer
      })
    default:
      return createInfoEmbed(embedTitle, description).setFooter({
        text: footer
      })
  }
}

export const postWorkerLog = async (
  client: Client<true>,
  payload: WorkerLogPayload
): Promise<void> => {
  const config = await getGuildConfigByGuildId({ guildId: payload.guildId })
  const channelId = config?.workerLogChannelId
  if (!channelId) return

  const guild = await client.guilds.fetch(payload.guildId).catch(() => null)
  if (!guild) return

  const rawChannel = await guild.channels.fetch(channelId).catch(() => null)
  if (!isGuildSendableChannel(rawChannel)) {
    logger.error(
      { channelId, guildId: payload.guildId },
      'Worker log channel not sendable'
    )
    return
  }

  const embed = buildWorkerEmbed(payload)

  const sendableChannel = rawChannel as
    | TextChannel
    | NewsChannel
    | ThreadChannel
  sendableChannel.send({ embeds: [embed] }).catch((err: unknown) => {
    logger.error(
      { err, guildId: payload.guildId, channelId, worker: payload.worker },
      'Failed to send worker log'
    )
  })
}
