import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  assertManagerOrAdmin,
  banUserDiscord,
  checkTargetUserRegistration,
  getGuildConfigByGuildId,
  resolveTargetHasManagerRole
} from '@/services'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export const command: CommandData = {
  name: 'ban',
  description: 'Ban a registered user from economy actions.',
  options: [
    {
      name: 'user',
      description: 'The user to ban.',
      type: ApplicationCommandOptionType.User,
      required: true
    },
    {
      name: 'reason',
      description: 'Optional reason for the ban.',
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

    const result = await banUserDiscord({
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
        embeds: [createErrorEmbed('Ban Failed', result.message)],
        flags: MessageFlags.Ephemeral
      })
    }

    logger.event(
      {
        action: 'user_banned',
        actorUserId: interaction.user.id,
        targetUserId: target.id,
        guildId: interaction.guildId
      },
      'User banned via Discord command'
    )

    const reasonLine = result.banReason
      ? `\n**Reason:** ${result.banReason}`
      : ''

    return interaction.reply({
      embeds: [
        createSuccessEmbed(
          'User Banned',
          `<@${target.id}> has been banned from economy actions.${reasonLine}`
        )
      ],
      flags: MessageFlags.Ephemeral
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
