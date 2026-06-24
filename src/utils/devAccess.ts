import {
  DEV_GUILDS,
  DEV_USERS,
  hasDevAccess as hasSharedDevAccess
} from 'gambling-bot-shared/dev'

import { MessageFlags } from 'discord.js'

import type { CommandMetadata } from 'commandkit'

export { DEV_GUILDS, DEV_USERS }

export function hasDevAccess(interaction: {
  guildId: string | null
  user: { id: string }
}): boolean {
  return hasSharedDevAccess(interaction.user.id, interaction.guildId)
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
