import { TUser } from 'gambling-bot-shared/user'

import { MessageFlags } from 'discord.js'

import { ChatInputCommand } from 'commandkit'

import { createErrorEmbed } from '@/utils/discord/createEmbed'

import { getUser } from '../db/user.db'

export const checkUserRegistration = async ({
  interaction
}: {
  interaction: Parameters<ChatInputCommand>[0]['interaction']
}): Promise<TUser | false> => {
  const user = await getUser({
    userId: interaction.user.id,
    guildId: interaction.guildId!
  })

  if (!user) {
    interaction.reply({
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

  return user
}

export const checkTargetUserRegistration = async ({
  interaction,
  targetUserId
}: {
  interaction: Parameters<ChatInputCommand>[0]['interaction']
  targetUserId: string
}): Promise<TUser | false> => {
  const targetUser = await getUser({
    userId: targetUserId,
    guildId: interaction.guildId!
  })

  if (!targetUser) {
    interaction.reply({
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
