import {
  ApplicationCommandOptionType,
  ChannelType,
  MessageFlags,
  TextChannel
} from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  addVipMemberAtomic,
  extendVipAtomic,
  finalizeVipPurchase,
  getActiveVipByOwner,
  getGuildConfigByGuildId,
  getUser,
  refundVipPurchase,
  removeVipMemberAtomic,
  reserveVipPurchase
} from '@/services'
import {
  formatNumberToReadableString,
  generateId,
  parseTimeToSeconds
} from '@/utils/common/utils'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'vip',
  description: 'VIP management commands.',
  dm_permission: false,
  options: [
    {
      name: 'info',
      description: 'Show VIP info.',
      type: ApplicationCommandOptionType.Subcommand
    },
    {
      name: 'buy',
      description: 'Purchase a VIP room for a specified duration.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'duration',
          description: 'Duration (e.g., 2d, 1w)',
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
    },
    {
      name: 'extend',
      description: 'Extend your current VIP duration.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
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
      description: 'Add a user to your VIP room.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'User to add to your VIP room.',
          type: ApplicationCommandOptionType.User,
          required: true
        }
      ]
    },
    {
      name: 'remove-member',
      description: 'Remove a user from your VIP room.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'User to remove from your VIP room.',
          type: ApplicationCommandOptionType.User,
          required: true
        }
      ]
    }
  ]
}

export const chatInput: ChatInputCommand = async (ctx) => {
  const { interaction } = ctx

  try {
    const guildConfiguration = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })
    if (!guildConfiguration) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Guild Not Configured',
            'This guild has not been configured yet. Please contact administrator.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (
      !guildConfiguration.vipSettings.categoryId ||
      guildConfiguration.vipSettings.pricePerDay === 0 ||
      !guildConfiguration.vipSettings.roleOwnerId ||
      !guildConfiguration.vipSettings.roleMemberId
    ) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'VIP Not Configured',
            'VIP category, price or VIP roles are not set yet. Please contact administrator.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const user = await getUser({
      userId: interaction.user.id,
      guildId: interaction.guildId!
    })

    if (!user) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Not Registered',
            'You must register first using /register.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const subcommand = interaction.options.getSubcommand()
    const pricePerDay = guildConfiguration.vipSettings.pricePerDay
    const pricePerCreate = guildConfiguration.vipSettings.pricePerCreate

    const vipRoleOwnerId = guildConfiguration.vipSettings.roleOwnerId
    const vipRoleMemberId = guildConfiguration.vipSettings.roleMemberId

    if (subcommand === 'buy') {
      const durationInput = interaction.options.getString('duration', true)

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

      const durationDays = durationSeconds / 86400
      let totalPrice = durationDays * pricePerDay
      if (pricePerCreate > 0) totalPrice += pricePerCreate

      await interaction.deferReply({ flags: MessageFlags.Ephemeral })

      const purchaseId = generateId()
      const expiresAt = new Date(Date.now() + durationSeconds * 1000)

      try {
        await reserveVipPurchase({
          userId: user.userId,
          guildId: user.guildId,
          totalPrice
        })
      } catch (err) {
        if (err instanceof Error && err.message === 'INSUFFICIENT_FUNDS') {
          return interaction.editReply({
            embeds: [
              createErrorEmbed('Insufficient Funds', 'Not enough balance.')
            ]
          })
        }

        if (err instanceof Error && err.message === 'VIP_ALREADY_EXISTS') {
          return interaction.editReply({
            embeds: [
              createErrorEmbed(
                'VIP Already Active',
                'You already have an active VIP room. Extend it instead of buying a new one.'
              )
            ]
          })
        }

        throw err
      }

      const guild = interaction.guild!
      const categoryId = guildConfiguration.vipSettings.categoryId

      let channel: TextChannel | null = null

      try {
        const now = new Date()
        const day = now.getDate().toString().padStart(2, '0')
        const month = (now.getMonth() + 1).toString().padStart(2, '0')

        const created = await guild.channels.create({
          name: `vip-${interaction.user.username}-${day}-${month}`,
          type: ChannelType.GuildText,
          parent: categoryId
        })

        if (!created.isTextBased() || created.isThread()) {
          throw new Error('Channel creation failed')
        }

        channel = created as unknown as TextChannel

        await channel.permissionOverwrites.edit(interaction.user.id, {
          ViewChannel: true,
          SendMessages: true
        })

        const member = await guild.members.fetch(interaction.user.id)
        await member.roles.add(vipRoleOwnerId)

        const msg = await channel.send({
          embeds: [
            createSuccessEmbed(
              'VIP Channel Ready',
              `Valid until <t:${Math.floor(expiresAt.getTime() / 1000)}:f>`
            )
          ]
        })
        await msg.pin()

        await finalizeVipPurchase({
          ownerId: user.userId,
          guildId: user.guildId,
          channelId: channel.id,
          expiresAt,
          purchaseId
        })
      } catch (discordError) {
        await refundVipPurchase({
          userId: user.userId,
          guildId: user.guildId,
          totalPrice,
          purchaseId
        })

        if (channel) {
          await channel.delete().catch()
        }

        throw discordError
      }

      return interaction.editReply({
        embeds: [
          createSuccessEmbed(
            'VIP Purchased',
            `Channel: <#${channel.id}>\nDuration: **${durationDays} day(s)**\nCost: **$${formatNumberToReadableString(totalPrice)}**`
          )
        ]
      })
    }

    if (subcommand === 'extend') {
      const existingVip = await getActiveVipByOwner({
        ownerId: interaction.user.id,
        guildId: interaction.guildId!
      })

      if (!existingVip) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'VIP Not Active',
              'You do not currently have an active VIP to extend.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const durationInput = interaction.options.getString('duration', true)

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

      const durationDays = durationSeconds / 86400
      const totalPrice = durationDays * pricePerDay
      const newExpiry = new Date(
        existingVip.expiresAt.getTime() + durationSeconds * 1000
      )

      await interaction.deferReply({ flags: MessageFlags.Ephemeral })

      try {
        await extendVipAtomic({
          userId: user.userId,
          guildId: user.guildId,
          totalPrice,
          newExpiry,
          durationDays
        })
      } catch (err: unknown) {
        if (err instanceof Error && err.message === 'INSUFFICIENT_FUNDS') {
          return interaction.editReply({
            embeds: [
              createErrorEmbed('Insufficient Funds', 'Not enough balance.')
            ]
          })
        }

        if (err instanceof Error && err.message === 'VIP_NOT_FOUND') {
          return interaction.editReply({
            embeds: [createErrorEmbed('VIP Missing', 'VIP no longer exists.')]
          })
        }

        throw err
      }

      const vipChannel = await interaction
        .guild!.channels.fetch(existingVip.channelId)
        .catch(() => null)

      if (vipChannel && vipChannel.isTextBased() && !vipChannel.isThread()) {
        const newExpiryUnix = Math.floor(newExpiry.getTime() / 1000)

        const extendMsg = await vipChannel.send({
          content: `Your VIP has been extended, ${interaction.user}!`,
          embeds: [
            createSuccessEmbed(
              'VIP Channel Extended',
              `New expiry: <t:${newExpiryUnix}:f>`
            )
          ]
        })

        await extendMsg.pin().catch()
      }

      return interaction.editReply({
        embeds: [
          createSuccessEmbed(
            'VIP Extended',
            `Your VIP has been extended by **${durationDays} day(s)**.\n` +
              `New expiry: <t:${Math.floor(newExpiry.getTime() / 1000)}:f>\n` +
              `You have been charged **$${formatNumberToReadableString(totalPrice)}**.`
          )
        ]
      })
    }

    if (subcommand === 'add-member') {
      const userToAdd = interaction.options.getUser('user', true)

      if (userToAdd.bot) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid User',
              'Bot accounts cannot be added to VIP rooms.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      if (userToAdd.id === interaction.user.id) {
        return interaction.reply({
          embeds: [
            createErrorEmbed('Invalid User', 'You cannot add yourself.')
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const vipRoom = await getActiveVipByOwner({
        ownerId: interaction.user.id,
        guildId: interaction.guildId!
      })

      if (!vipRoom) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'No Active VIP',
              'You must own an active VIP room to add members.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral })

      let chargedAmount = 0

      try {
        chargedAmount = await addVipMemberAtomic({
          ownerId: user.userId,
          guildId: user.guildId,
          memberId: userToAdd.id
        })
      } catch (err) {
        if (err instanceof Error && err.message === 'VIP_NOT_FOUND') {
          return interaction.editReply({
            embeds: [createErrorEmbed('VIP Missing', 'VIP no longer exists.')]
          })
        }

        if (err instanceof Error && err.message === 'ALREADY_MEMBER') {
          return interaction.editReply({
            embeds: [
              createErrorEmbed(
                'Already a Member',
                'That user is already a member of your VIP room.'
              )
            ]
          })
        }

        if (err instanceof Error && err.message === 'VIP_FULL') {
          return interaction.editReply({
            embeds: [
              createErrorEmbed(
                'VIP Room Full',
                'Your VIP room has reached the maximum number of allowed members. Remove someone before adding a new member.'
              )
            ]
          })
        }

        if (err instanceof Error) {
          return interaction.editReply({
            embeds: [createErrorEmbed('Cannot Add Member', err.message)]
          })
        }
        throw err
      }

      const member = await interaction
        .guild!.members.fetch(userToAdd.id)
        .catch(() => null)
      if (member) await member.roles.add(vipRoleMemberId).catch()

      const channel = await interaction
        .guild!.channels.fetch(vipRoom.channelId)
        .catch(() => null)
      if (channel && channel.isTextBased() && !channel.isThread()) {
        await channel.permissionOverwrites
          .edit(userToAdd.id, { ViewChannel: true, SendMessages: true })
          .catch()
      }

      return interaction.editReply({
        embeds: [
          createSuccessEmbed(
            'Member Added',
            `${userToAdd} added to VIP.\nCharge: **$${formatNumberToReadableString(chargedAmount)}**`
          )
        ]
      })
    }

    if (subcommand === 'remove-member') {
      const userToRemove = interaction.options.getUser('user', true)

      if (userToRemove.bot) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid User',
              'Bot accounts cannot be added to VIP rooms.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const vipRoom = await getActiveVipByOwner({
        ownerId: interaction.user.id,
        guildId: interaction.guildId!
      })

      if (!vipRoom) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'No Active VIP',
              'You must own an active VIP room to remove members.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      if (userToRemove.id === interaction.user.id) {
        return interaction.reply({
          embeds: [
            createErrorEmbed('Invalid User', 'You cannot remove yourself.')
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral })

      try {
        await removeVipMemberAtomic({
          ownerId: interaction.user.id,
          guildId: interaction.guildId!,
          memberId: userToRemove.id
        })
      } catch (err) {
        if (err instanceof Error && err.message === 'VIP_NOT_FOUND') {
          return interaction.editReply({
            embeds: [createErrorEmbed('VIP Missing', 'VIP no longer exists.')]
          })
        }

        if (err instanceof Error && err.message === 'NOT_A_MEMBER') {
          return interaction.editReply({
            embeds: [
              createErrorEmbed(
                'User Not in VIP',
                'That user is not a member of your VIP room.'
              )
            ]
          })
        }

        if (err instanceof Error) {
          return interaction.editReply({
            embeds: [createErrorEmbed('Cannot Remove Member', err.message)]
          })
        }
        throw err
      }

      const member = await interaction
        .guild!.members.fetch(userToRemove.id)
        .catch(() => null)
      if (member) await member.roles.remove(vipRoleMemberId).catch()

      const channel = await interaction
        .guild!.channels.fetch(vipRoom.channelId)
        .catch(() => null)
      if (channel && channel.isTextBased() && !channel.isThread()) {
        await channel.permissionOverwrites
          .edit(userToRemove.id, { ViewChannel: false, SendMessages: false })
          .catch()
      }

      return interaction.editReply({
        embeds: [
          createSuccessEmbed(
            'Member Removed',
            `${userToRemove} has been removed from your VIP room.`
          )
        ]
      })
    }

    if (subcommand === 'info') {
      const maxDays =
        pricePerDay > 0 ? Math.floor(user.balance / pricePerDay) : 0

      const vipRoom = await getActiveVipByOwner({
        ownerId: interaction.user.id,
        guildId: interaction.guildId!
      })

      let vipInfoSection = ''

      if (vipRoom) {
        const ownerMention = `<@${vipRoom.ownerId}>`

        const memberMentions =
          vipRoom.memberIds.length > 0
            ? vipRoom.memberIds
                .slice(0, 10)
                .map((id) => `<@${id}>`)
                .join(', ') +
              (vipRoom.memberIds.length > 10
                ? ` +${vipRoom.memberIds.length - 10} more`
                : '')
            : '_No additional members_'

        vipInfoSection =
          `\n**Your VIP Room:** <#${vipRoom.channelId}>\n` +
          `**Owner:** ${ownerMention}\n` +
          `**Members:** ${memberMentions}\n` +
          `**Expires:** <t:${Math.floor(vipRoom.expiresAt.getTime() / 1000)}:f>\n\n`
      }

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'VIP Info',
            vipInfoSection +
              (pricePerCreate > 0
                ? `Price per create: **$${formatNumberToReadableString(pricePerCreate)}**\n`
                : '') +
              `Price per day: **$${formatNumberToReadableString(pricePerDay)}**\n\n` +
              `Your balance: **$${formatNumberToReadableString(user.balance)}**\n` +
              `You can afford VIP for up to **${maxDays} day(s)** (excluding creation fee).`
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
