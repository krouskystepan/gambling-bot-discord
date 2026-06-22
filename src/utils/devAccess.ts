import { MessageFlags } from 'discord.js'

import type { CommandMetadata } from 'commandkit'

export const DEV_GUILDS = ['1298805664654561340']

/** Discord user IDs allowed to run dev commands outside dev guilds. */
export const DEV_USERS: string[] = []

export function hasDevAccess(interaction: {
  guildId: string | null
  user: { id: string }
}): boolean {
  if (interaction.guildId && DEV_GUILDS.includes(interaction.guildId)) {
    return true
  }

  return DEV_USERS.includes(interaction.user.id)
}

export async function assertDevAccess(interaction: {
  guildId: string | null
  user: { id: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- structural type for commandkit + discord.js
  reply: (...args: any[]) => Promise<unknown>
}): Promise<boolean> {
  if (hasDevAccess(interaction)) {
    return true
  }

  await interaction.reply({
    content: '⚠️ This command is restricted to dev guilds or dev users.',
    flags: MessageFlags.Ephemeral
  })

  return false
}

export const devCommandMetadata: CommandMetadata = {
  botPermissions: ['Administrator'],
  guilds: DEV_GUILDS
}
