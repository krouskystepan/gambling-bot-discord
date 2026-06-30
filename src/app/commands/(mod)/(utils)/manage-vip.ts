import { parseTimeToSeconds } from 'gambling-bot-shared/common'

import {
  ApplicationCommandOptionType,
  ChannelType,
  MessageFlags,
  TextChannel
} from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  addMemberToVip,
  createTransaction,
  createVip,
  deleteVipByOwnerId,
  extendVipExpiry,
  getActiveVipByOwner,
  getGuildConfigByGuildId,
  getUser
} from '@/services'
import { isGuildSendableChannel } from '@/utils/discord/channelGuards'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export const command: CommandData = {
  name: 'manage-vip',
  description: 'Admin commands to manage VIP rooms.',
  dm_permission: false,
  options: [
    {
      name: 'create-room',
      description: 'Create a VIP room for a user.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user who will receive the VIP room.',
          type: ApplicationCommandOptionType.User,
          required: true
        },
        {
          name: 'duration',
          description: 'Duration (e.g., 2d, 1w)',
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
    },
    {
      name: 'remove-room',
      description: 'Remove a user’s VIP room.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user whose VIP room should be removed.',
          type: ApplicationCommandOptionType.User,
          required: true
        }
      ]
    },
    {
      name: 'extend-room',
      description: 'Extend a user’s VIP room.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user whose VIP room should be extended.',
          type: ApplicationCommandOptionType.User,
          required: true
        },
        {
          name: 'duration',
          description: 'Extra duration to add (e.g., 2d, 1w)',
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
    },
    {
      name: 'add-member',
      description: 'Add a member to someone’s VIP room.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user who will be added to the VIP room.',
          type: ApplicationCommandOptionType.User,
          required: true
        },
        {
          name: 'owner',
          description: 'The owner of the VIP room to add the member to.',
          type: ApplicationCommandOptionType.User,
          required: true
        },
        {
          name: 'bypass-member-limit',
          description: 'Bypass max member limit.',
          type: ApplicationCommandOptionType.Boolean,
          required: false
        }
      ]
    }
  ]
}

export const metadata: CommandMetadata = {
  botPermissions: ['Administrator']
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const guildConfiguration = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })
    if (!guildConfiguration) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Guild Not Configured',
            'This guild has not been configured yet. Please set it up first.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const member = await interaction.guild?.members.fetch(interaction.user.id)
    const hasAdmin = member?.permissions.has('Administrator')
    const managerRoleId = guildConfiguration.managerRoleId
    const hasManager = managerRoleId && member?.roles.cache.has(managerRoleId)

    if (!hasAdmin && !hasManager) {
      return interaction.reply({
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
    }

    const subcommand = interaction.options.getSubcommand()

    const vipRoleOwnerId = guildConfiguration.vipSettings.roleOwnerId
    const vipRoleMemberId = guildConfiguration.vipSettings.roleMemberId

    if (subcommand === 'create-room') {
      const targetedUser = interaction.options.getUser('user', true)
      const durationInput = interaction.options.getString('duration', true)

      if (targetedUser.bot) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid Input - Bot user',
              'You cannot create a VIP room for bots.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const targetUser = await getUser({
        userId: targetedUser.id,
        guildId: interaction.guildId!
      })
      if (!targetUser) return

      const existingVip = await getActiveVipByOwner({
        ownerId: targetedUser.id,
        guildId: interaction.guildId!
      })

      if (existingVip) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'VIP Already Active',
              `User <@${targetedUser.id}> already has a VIP channel: <#${existingVip.channelId}>.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      if (!/^(\d+[dw])+$/i.test(durationInput)) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid Input - Invalid Duration',
              'Format is invalid. Use whole numbers only, e.g., 1d, 2w.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const durationSeconds = parseTimeToSeconds(durationInput)
      if (durationSeconds < 86400) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid Input - Duration Too Short',
              'The duration must be at least 1 day (1d).'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const guild = interaction.guild!
      const categoryId = guildConfiguration.vipSettings.categoryId

      const expiresAt = new Date(Date.now() + durationSeconds * 1000)

      const now = new Date()
      const day = now.getDate().toString().padStart(2, '0')
      const month = (now.getMonth() + 1).toString().padStart(2, '0')

      let channel: TextChannel | null = null

      try {
        const created = await guild.channels.create({
          name: `vip-${interaction.user.username}-${day}-${month}`,
          type: ChannelType.GuildText,
          parent: categoryId
        })

        if (!created.isTextBased() || created.isThread()) {
          throw new Error('Channel creation failed')
        }

        channel = created as unknown as TextChannel

        await channel.permissionOverwrites.edit(targetedUser.id, {
          ViewChannel: true,
          SendMessages: true
        })

        await createVip({
          ownerId: targetedUser.id,
          guildId: interaction.guildId!,
          channelId: channel.id,
          expiresAt
        })

        await createTransaction({
          userId: targetedUser.id,
          guildId: interaction.guildId!,
          amount: 0,
          type: 'vip',
          source: 'command',
          handledBy: interaction.user.id,
          meta: {
            adminAction: 'admin-buy',
            durationDays: Math.floor(durationSeconds / 86400)
          }
        })
      } catch (err) {
        if (channel) await channel.delete().catch(() => null)
        throw err
      }

      const vipChannelCreatedMsg = await channel.send({
        content: `Welcome to your VIP channel, <@${targetedUser.id}>! 🎉`,
        embeds: [
          createSuccessEmbed(
            'VIP Channel Ready',
            `Your channel <#${channel.id}> is valid until <t:${Math.floor(
              expiresAt.getTime() / 1000
            )}:f>`
          )
        ]
      })

      await vipChannelCreatedMsg.pin()

      const member = await guild.members.fetch(targetedUser.id)
      await member.roles.add(
        vipRoleOwnerId,
        `VIP created by admin ${interaction.user}`
      )

      logger.event(
        {
          action: 'vip_create',
          actorId: interaction.user.id,
          targetUserId: targetedUser.id,
          channelId: channel.id,
          guildId: interaction.guildId
        },
        'Admin created VIP room'
      )

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'VIP Room Created',
            `VIP room <#${channel.id}> has been created for <@${targetedUser.id}>.\n` +
              `It will expire <t:${Math.floor(expiresAt.getTime() / 1000)}:R>.`
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (subcommand === 'remove-room') {
      const targetedUser = interaction.options.getUser('user', true)

      if (targetedUser.bot) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid Input - Bot user',
              'You cannot remove a VIP room for bot.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const existingVip = await getActiveVipByOwner({
        ownerId: targetedUser.id,
        guildId: interaction.guildId!
      })

      if (!existingVip) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'VIP Not Active',
              `User <@${targetedUser.id}> does not currently have an active VIP room.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const channel = await interaction
        .guild!.channels.fetch(existingVip.channelId)
        .catch(() => null)

      if (!isGuildSendableChannel(channel)) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Wrong Discord Configuration',
              'Channel misconfigured or inaccessible.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const sendableChannel = channel as TextChannel

      await sendableChannel.permissionOverwrites
        .edit(targetedUser.id, {
          SendMessages: false
        })
        .catch(() => null)

      await sendableChannel
        .send({
          content: `<@${targetedUser.id}>`,
          embeds: [
            createErrorEmbed(
              'VIP Channel Removed',
              '⏰ Your VIP access has been removed. You no longer have permission to send messages in this channel. You will keep **read-only access**'
            )
          ]
        })
        .catch(() => null)

      if (vipRoleOwnerId) {
        const owner = await interaction
          .guild!.members.fetch(targetedUser.id)
          .catch(() => null)

        if (owner) {
          await owner.roles
            .remove(vipRoleOwnerId, 'VIP Owner removed by admin')
            .catch(() => null)
        }
      }

      if (vipRoleMemberId) {
        for (const memberId of existingVip.memberIds) {
          const member = await interaction
            .guild!.members.fetch(memberId)
            .catch(() => null)
          if (!member) continue

          const channel = await interaction
            .guild!.channels.fetch(existingVip.channelId)
            .catch(() => null)

          if (channel && channel.isTextBased() && !channel.isThread()) {
            await channel.permissionOverwrites
              .delete(memberId)
              .catch(() => null)
          }

          await member.roles
            .remove(vipRoleMemberId, 'VIP Member removed by admin')
            .catch(() => null)

          if (channel && channel.isTextBased() && !channel.isThread()) {
            await channel.permissionOverwrites
              .edit(targetedUser.id, { SendMessages: false })
              .catch(() => null)
          }
        }
      }

      await deleteVipByOwnerId({
        ownerId: targetedUser.id,
        guildId: interaction.guildId!
      })

      logger.event(
        {
          action: 'vip_remove',
          actorId: interaction.user.id,
          targetUserId: targetedUser.id,
          guildId: interaction.guildId
        },
        'Admin removed VIP room'
      )

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'VIP Removed',
            `The VIP of <@${targetedUser.id}> has been removed.\n` +
              `Channel is no longer accessible for them. They will keep read-only access.`
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (subcommand === 'extend-room') {
      const targetedUser = interaction.options.getUser('user', true)
      const durationInput = interaction.options.getString('duration', true)

      if (targetedUser.bot) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid Input - Bot user',
              'You cannot extend VIP for bots.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      if (!/^(\d+[dw])+$/i.test(durationInput)) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid Input - Invalid Format',
              'Duration format is invalid. Use whole numbers only, e.g., 1d, 2w.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const durationSeconds = parseTimeToSeconds(durationInput)
      if (durationSeconds < 86400) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid Input - Duration Too Short',
              'The duration must be at least 1 day (1d).'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const existingVip = await getActiveVipByOwner({
        ownerId: targetedUser.id,
        guildId: interaction.guildId!
      })

      if (!existingVip) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'VIP Not Found',
              `User <@${targetedUser.id}> does not currently have an active VIP room.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const updatedVip = await extendVipExpiry({
        ownerId: targetedUser.id,
        guildId: interaction.guildId!,
        newExpiry: new Date(
          existingVip.expiresAt.getTime() + durationSeconds * 1000
        )
      })

      if (!updatedVip) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'VIP Not Found',
              `User <@${targetedUser.id}> does not currently have an active VIP room.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      await createTransaction({
        userId: targetedUser.id,
        guildId: interaction.guildId!,
        amount: 0,
        type: 'vip',
        source: 'command',
        handledBy: interaction.user.id,
        meta: {
          adminAction: 'admin-extend',
          durationDays: Math.floor(durationSeconds / 86400)
        }
      })

      const vipChannel = await interaction
        .guild!.channels.fetch(updatedVip.channelId)
        .catch(() => null)

      if (vipChannel?.isTextBased()) {
        const extendMsg = await vipChannel.send({
          content: `<@${targetedUser.id}>`,
          embeds: [
            createSuccessEmbed(
              'VIP Channel Extended',
              `Your VIP now expires on <t:${Math.floor(updatedVip.expiresAt.getTime() / 1000)}:f>.`
            )
          ]
        })
        await extendMsg.pin()
      }

      logger.event(
        {
          action: 'vip_extend',
          actorId: interaction.user.id,
          targetUserId: targetedUser.id,
          channelId: updatedVip.channelId,
          guildId: interaction.guildId,
          durationDays: Math.floor(durationSeconds / 86400)
        },
        'Admin extended VIP room'
      )

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'VIP Extended',
            `The VIP of <@${targetedUser.id}> has been extended by **${
              durationSeconds / 86400
            } day(s)**.\nNow expires on: <t:${Math.floor(updatedVip.expiresAt.getTime() / 1000)}:f>`
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (subcommand === 'add-member') {
      const userToAdd = interaction.options.getUser('user', true)
      const ownerUser = interaction.options.getUser('owner', true)
      const bypass =
        interaction.options.getBoolean('bypass-member-limit') ?? false

      if (userToAdd.bot) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid Input - Bot User',
              'You cannot add bot users to VIP rooms.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const vipRoom = await getActiveVipByOwner({
        ownerId: ownerUser.id,
        guildId: interaction.guildId!
      })

      if (!vipRoom) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'VIP Not Found',
              `<@${ownerUser.id}> does not have an active VIP room.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      if (userToAdd.id === ownerUser.id) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Not Allowed',
              'The owner is already part of the VIP room.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      if (vipRoom.memberIds.includes(userToAdd.id)) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Already Added',
              `${userToAdd} is already a member of this VIP room.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      if (
        !bypass &&
        vipRoom.memberIds.length >= guildConfiguration.vipSettings.maxMembers
      ) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'VIP Full',
              `This VIP room is full. Max members allowed: **${guildConfiguration.vipSettings.maxMembers}**`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      await addMemberToVip({
        ownerId: ownerUser.id,
        guildId: interaction.guildId!,
        memberId: userToAdd.id
      })

      if (vipRoleMemberId) {
        const guild = interaction.guild!
        const member = await guild.members.fetch(userToAdd.id).catch(() => null)
        if (member) {
          await member.roles
            .add(vipRoleMemberId, 'VIP Member added by admin')
            .catch(() => null)
        }
      }

      const channel = interaction.guild?.channels.cache.get(vipRoom.channelId)
      if (channel && channel.isTextBased() && !channel.isThread()) {
        await channel.permissionOverwrites.edit(userToAdd.id, {
          ViewChannel: true,
          SendMessages: true
        })
      }

      await createTransaction({
        userId: ownerUser.id,
        guildId: interaction.guildId!,
        amount: 0,
        type: 'vip',
        source: 'command',
        handledBy: interaction.user.id,
        meta: {
          adminAction: 'admin-add-member',
          addedUserId: userToAdd.id,
          bypassUsed: bypass
        }
      })

      logger.event(
        {
          action: 'vip_add_member',
          actorId: interaction.user.id,
          ownerId: ownerUser.id,
          memberId: userToAdd.id,
          channelId: vipRoom.channelId,
          guildId: interaction.guildId,
          bypass
        },
        'Admin added member to VIP room'
      )

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Member Added',
            `${userToAdd} has been added to <@${ownerUser.id}>'s VIP room.` +
              (bypass
                ? `\n\nBypass mode was used - max member limit ignored.`
                : '')
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
