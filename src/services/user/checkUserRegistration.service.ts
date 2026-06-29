import {
  TUser,
  USER_BANNED_MESSAGE,
  isUserBanned
} from 'gambling-bot-shared/user'

import { MessageFlags } from 'discord.js'

import { ChatInputCommand } from 'commandkit'

import { createErrorEmbed } from '@/utils/discord/createEmbed'

import { getUser } from '../db/user.db'

type RepliableInteraction = Parameters<ChatInputCommand>[0]['interaction']

export async function assertNotBanned({
  user,
  interaction
}: {
  user: TUser
  interaction: RepliableInteraction
}): Promise<boolean> {
  if (!isUserBanned(user)) return true

  await interaction.reply({
    embeds: [createErrorEmbed('Account Restricted', USER_BANNED_MESSAGE)],
    flags: MessageFlags.Ephemeral
  })

  return false
}

export const checkUserRegistration = async ({
  interaction,
  allowBanned = false
}: {
  interaction: RepliableInteraction
  allowBanned?: boolean
}): Promise<TUser | false> => {
  const user = await getUser({
    userId: interaction.user.id,
    guildId: interaction.guildId!
  })

  if (!user) {
    await interaction.reply({
      embeds: [
        createErrorEmbed(
          'Error - Not registered',
          'You are not registered yet.\nUse the `/register` command to register.'
        )
      ],
      flags: MessageFlags.Ephemeral
    })
    return false
  }

  if (!allowBanned && isUserBanned(user)) {
    await assertNotBanned({ user, interaction })
    return false
  }

  return user
}

export const checkTargetUserRegistration = async ({
  interaction,
  targetUserId
}: {
  interaction: RepliableInteraction
  targetUserId: string
}): Promise<TUser | false> => {
  const targetUser = await getUser({
    userId: targetUserId,
    guildId: interaction.guildId!
  })

  if (!targetUser) {
    await interaction.reply({
      embeds: [
        createErrorEmbed(
          'Error - Not registered',
          'The target user is not registered yet.\nAsk them to use the `/register` command.'
        )
      ],
      flags: MessageFlags.Ephemeral
    })
    return false
  }

  return targetUser
}
