import { MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import { createInfoEmbed } from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'ping',
  description: 'Check the bot latency.'
}

const formatUptime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [
    days && `${days}d`,
    hours && `${hours}h`,
    minutes && `${minutes}m`,
    `${seconds}s`
  ]
    .filter(Boolean)
    .join(' ')
}

export const chatInput: ChatInputCommand = async ({ interaction, client }) => {
  try {
    const start = Date.now()

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral
    })

    const clientPing = Date.now() - start
    const wsPing = client.ws.ping ?? 0
    const uptime = formatUptime(client.uptime ?? 0)

    await interaction.editReply({
      embeds: [
        createInfoEmbed(
          '🏓 Pong!',
          [
            `**Client latency:** \`${clientPing}ms\``,
            `**WebSocket latency:** \`${wsPing}ms\``,
            `**Uptime:** \`${uptime}\``
          ].join('\n')
        )
      ]
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
