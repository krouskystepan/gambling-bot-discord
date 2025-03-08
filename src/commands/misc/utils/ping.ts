import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import { createSuccessEmbed } from '../../../utils/createEmbed'

export const data: CommandData = {
  name: 'ping',
  description: 'Check the bot latency.',
}

export const options: CommandOptions = {
  deleted: false,
}

export async function run({ interaction, client }: SlashCommandProps) {
  await interaction.deferReply()

  const reply = await interaction.fetchReply()

  const ping = reply.createdTimestamp - interaction.createdTimestamp

  interaction.editReply({
    embeds: [
      createSuccessEmbed(
        'Pong! 🏓',
        `**・** Klient: \`${ping}ms\` \n **・** Websocket: \`${client.ws.ping}ms\``
      ),
    ],
  })
}
