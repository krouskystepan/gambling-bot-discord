import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  assertManagerOrAdmin,
  checkTargetUserRegistration,
  getGuildConfigByGuildId,
  resolveTargetHasManagerRole,
  unbanUserDiscord
} from '@/services'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export const command: CommandData = {
  name: 'unban',
  description: 'Unban a registered user and restore economy access.',
  options: [
    {
      name: 'user',
      description: 'The user to unban.',
      type: ApplicationCommandOptionType.User,
      required: true
    },
    {
      name: 'reason',
      description: 'Optional reason for the unban.',
      type: ApplicationCommandOptionType.String,
      required: false
    }
  ],
  dm_permission: false
}

export const metadata: CommandMetadata = {
  botPermissions: ['Administrator']
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const guildConfig = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })

    const access = await assertManagerOrAdmin(interaction, guildConfig)
    if (!access.ok) return

    const target = interaction.options.getUser('user', true)

    if (target.bot) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Invalid Input - Bot user',
            'This command cannot target a bot.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const targetUser = await checkTargetUserRegistration({
      interaction,
      targetUserId: target.id
    })
    if (!targetUser) return

    const targetMember = await interaction.guild?.members
      .fetch(target.id)
      .catch(() => null)

    const targetHasManagerRole = resolveTargetHasManagerRole({
      managerRoleId: guildConfig?.managerRoleId,
      guildMember: targetMember
    })

    const reason = interaction.options.getString('reason') ?? undefined

    const result = await unbanUserDiscord({
      guildId: interaction.guildId!,
      actorUserId: interaction.user.id,
      actorIsElevated: access.isElevated,
      targetUserId: target.id,
      targetHasManagerRole,
      reason,
      guildMember: targetMember,
      bannedRoleId: guildConfig?.bannedRoleId
    })

    if (!result.ok) {
      return interaction.reply({
        embeds: [createErrorEmbed('Unban Failed', result.message)],
        flags: MessageFlags.Ephemeral
      })
    }

    logger.event(
      {
        action: 'user_unbanned',
        actorUserId: interaction.user.id,
        targetUserId: target.id,
        guildId: interaction.guildId
      },
      'User unbanned via Discord command'
    )

    const reasonLine = result.unbanReason
      ? `\n**Reason:** ${result.unbanReason}`
      : ''

    return interaction.reply({
      embeds: [
        createSuccessEmbed(
          'User Unbanned',
          `<@${target.id}> has been unbanned and can use economy actions again.${reasonLine}`
        )
      ],
      flags: MessageFlags.Ephemeral
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
