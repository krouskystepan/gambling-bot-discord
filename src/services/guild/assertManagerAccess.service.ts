import { TGuildConfiguration } from 'gambling-bot-shared/guild'

import { MessageFlags } from 'discord.js'

import { ChatInputCommand } from 'commandkit'

import { createErrorEmbed } from '@/utils/discord/createEmbed'

type RepliableInteraction = Parameters<ChatInputCommand>[0]['interaction']

export async function assertManagerOrAdmin(
  interaction: RepliableInteraction,
  guildConfig: Pick<TGuildConfiguration, 'managerRoleId'> | null
): Promise<{ ok: true; isElevated: boolean } | { ok: false }> {
  const member = await interaction.guild?.members.fetch(interaction.user.id)
  const isElevated = Boolean(member?.permissions.has('Administrator'))
  const managerRoleId = guildConfig?.managerRoleId
  const hasManager = Boolean(
    managerRoleId && member?.roles.cache.has(managerRoleId)
  )

  if (!isElevated && !hasManager) {
    await interaction.reply({
      embeds: [
        createErrorEmbed(
          'Permission Denied',
          `You need to be an **Administrator** or have the ${
            managerRoleId ? `<@&${managerRoleId}>` : '**Manager role**'
          } to use this command.`
        )
      ],
      flags: MessageFlags.Ephemeral
    })
    return { ok: false }
  }

  return { ok: true, isElevated }
}
