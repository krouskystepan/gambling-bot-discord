import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import {
  ApplicationCommandOptionType,
  MessageFlags,
  ChannelType,
  TextChannel,
} from 'discord.js'
import GuildConfiguration from '../../../models/GuildConfiguration'
import VipRoom from '../../../models/VipRoom'
import User from '../../../models/User'
import {
  createErrorEmbed,
  createInfoEmbed,
  createSuccessEmbed,
} from '../../../utils/createEmbed'
import {
  checkChannelConfiguration,
  parseTimeToSeconds,
} from '../../../utils/utils'

export const data: CommandData = {
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
          required: true,
        },
        {
          name: 'duration',
          description: 'Duration (e.g., 2d, 1w)',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
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
          required: true,
        },
      ],
    },
  ],
}

export const options: CommandOptions = {
  botPermissions: ['Administrator'],
  deleted: false,
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    const configReply = await checkChannelConfiguration(
      interaction,
      'adminChannelIds',
      {
        notSet:
          'This server has not been configured for admin commands yet. Set it up using `/setup-admin` and `/setup-manager` .',
        notAllowed: `This channel is not configured for admin commands. Try one of these channels:`,
      }
    )

    if (!configReply) return

    const member = await interaction.guild?.members.fetch(interaction.user.id)
    const hasAdmin = member?.permissions.has('Administrator')
    const managerRoleId = configReply.vipSettings.roleId
    const hasManager = managerRoleId && member?.roles.cache.has(managerRoleId)

    if (!hasAdmin && !hasManager) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Permission Denied',
            `You need to be an **Administrator** or have the ${
              managerRoleId ? `<@&${managerRoleId}>` : '**Manager role**'
            } to use this command.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const subcommand = interaction.options.getSubcommand()

    if (subcommand === 'create-room') {
      const targetedUser = interaction.options.getUser('user', true)
      const durationInput = interaction.options.getString('duration', true)

      if (targetedUser.bot) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Invalid Input - Bot user',
              'You cannot create a VIP room for bots.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const user = await User.findOne({
        userId: targetedUser.id,
        guildId: interaction.guildId!,
      })

      if (!user) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - User Not Registered',
              'This user has not registered yet. Use `/register` or `/force-register` first.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const existingVip = await VipRoom.findOne({
        userId: targetedUser.id,
        guildId: interaction.guildId!,
        expiresAt: { $gt: new Date() },
      })

      if (existingVip) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'VIP Already Active',
              `User <@${targetedUser.id}> already has a VIP channel: <#${existingVip.channelId}>.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      if (!/^(\d+[dw])+$/i.test(durationInput)) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Invalid Input - Invalid Duration',
              'Format is invalid. Use whole numbers only, e.g., 1d, 2w.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const durationSeconds = parseTimeToSeconds(durationInput)
      if (durationSeconds < 86400) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Invalid Input - Duration Too Short',
              'The duration must be at least 1 day (1d).'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const guild = interaction.guild!
      const categoryId = configReply.vipSettings.categoryId
      const vipRoleId = configReply.vipSettings.roleId

      const expiresAt = new Date(Date.now() + durationSeconds * 1000)

      const now = new Date()
      const day = now.getDate().toString().padStart(2, '0')
      const month = (now.getMonth() + 1).toString().padStart(2, '0')

      const channel = await guild.channels.create({
        name: `vip-${targetedUser.username}-${day}-${month}`,
        type: ChannelType.GuildText,
        parent: categoryId,
      })

      await channel.permissionOverwrites.edit(targetedUser.id, {
        ViewChannel: true,
        SendMessages: true,
      })

      const vipChannelCreatedMsg = await channel.send({
        content: `Welcome to your VIP channel, <@${targetedUser.id}>! 🎉`,
        embeds: [
          createSuccessEmbed(
            'VIP Channel Ready',
            `Your channel <#${channel.id}> is valid until <t:${Math.floor(
              expiresAt.getTime() / 1000
            )}:f>`
          ),
        ],
      })

      await vipChannelCreatedMsg.pin()

      const member = await guild.members.fetch(targetedUser.id)
      await member.roles.add(
        vipRoleId,
        `VIP created by admin ${interaction.user}`
      )

      await VipRoom.create({
        userId: targetedUser.id,
        guildId: interaction.guildId!,
        channelId: channel.id,
        expiresAt,
      })

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'VIP Room Created',
            `VIP room <#${channel.id}> has been created for <@${targetedUser.id}>.\n` +
              `It will expire <t:${Math.floor(expiresAt.getTime() / 1000)}:R>.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (subcommand === 'remove-room') {
      const targetedUser = interaction.options.getUser('user', true)

      if (targetedUser.bot) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Invalid Input - Bot user',
              'You cannot remove a VIP room for bot.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const existingVip = await VipRoom.findOne({
        userId: targetedUser.id,
        guildId: interaction.guildId!,
        expiresAt: { $gt: new Date() },
      })

      if (!existingVip) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'VIP Not Active',
              `User <@${targetedUser.id}> does not currently have an active VIP room.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const channel = (await interaction
        .guild!.channels.fetch(existingVip.channelId)
        .catch(() => null)) as TextChannel

      if (channel && channel.isTextBased()) {
        await channel.permissionOverwrites
          .edit(targetedUser.id, {
            SendMessages: false,
          })
          .catch(() => null)

        await channel
          .send({
            content: `<@${targetedUser.id}>`,
            embeds: [
              createInfoEmbed(
                'VIP Channel Removed',
                '⏰ Your VIP access has been removed. You no longer have access to this channel.'
              ),
            ],
          })
          .catch(() => null)
      }

      const guildConfig = await GuildConfiguration.findOne({
        guildId: interaction.guildId!,
      })
      if (guildConfig?.vipSettings?.roleId) {
        const member = await interaction
          .guild!.members.fetch(targetedUser.id)
          .catch(() => null)
        if (member) {
          await member.roles
            .remove(guildConfig.vipSettings.roleId, 'VIP removed by admin')
            .catch(() => null)
        }
      }

      await existingVip.deleteOne()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'VIP Removed',
            `The VIP of <@${targetedUser.id}> has been removed.\nChannel <#${existingVip.channelId}> is no longer accessible for them.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }
  } catch (error) {
    console.error('Error running /manage-vip:', error)
  }
}
