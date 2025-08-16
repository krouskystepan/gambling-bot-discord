import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'
import VipRoom from '../../../models/VipRoom'
import User from '../../../models/User'
import GuildConfiguration from '../../../models/GuildConfiguration'
import {
  createErrorEmbed,
  createInfoEmbed,
  createSuccessEmbed,
} from '../../../utils/createEmbed'
import {
  formatNumberToReadableString,
  parseTimeToSeconds,
} from '../../../utils/utils'

export const data: CommandData = {
  name: 'vip',
  description: 'VIP management commands.',
  dm_permission: false,
  options: [
    {
      name: 'buy',
      description: 'Purchase a VIP room for a specified duration.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'duration',
          description: 'Duration (e.g., 2d, 1w)',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: 'info',
      description: 'Show VIP info, price and how long you can afford it.',
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
}

export const options: CommandOptions = {
  deleted: false,
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    const guildConfiguration = await GuildConfiguration.findOne({
      guildId: interaction.guildId,
    })

    if (
      !guildConfiguration?.vipSettings.categoryId ||
      !guildConfiguration?.vipSettings.roleId ||
      guildConfiguration.vipSettings.pricePerDay === 0
    ) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'VIP Not Configured',
            'VIP category, role or price is not set yet. Please contact administrator.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const user = await User.findOne({
      userId: interaction.user.id,
      guildId: interaction.guildId!,
    })
    if (!user) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Not Registered',
            'You must register first using /register.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const subcommand = interaction.options.getSubcommand()
    const pricePerDay = guildConfiguration.vipSettings.pricePerDay

    if (subcommand === 'info') {
      const maxDays = Math.floor(user.balance / pricePerDay)
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'VIP Info',
            `Price per day: **$${formatNumberToReadableString(
              pricePerDay
            )}**\n` +
              `Your balance: **$${formatNumberToReadableString(
                user.balance
              )}**\n` +
              `You can afford VIP for up to **${maxDays} day(s)**.\n`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (subcommand === 'buy') {
      const existingVip = await VipRoom.findOne({
        userId: interaction.user.id,
        guildId: interaction.guildId!,
        expiresAt: { $gt: new Date() },
      })
      if (existingVip) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'VIP Already Active',
              `You already have a VIP channel <#${existingVip.channelId}>.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const durationInput = interaction.options.getString('duration', true)
      const durationSeconds = parseTimeToSeconds(durationInput)
      if (!durationSeconds || durationSeconds < 86400) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Invalid Duration',
              'Invalid format or less than 1 day (1d).'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const durationDays = durationSeconds / 86400
      const totalPrice = durationDays * pricePerDay
      const affordableDays = Math.floor(user.balance / pricePerDay)

      if (user.balance < totalPrice) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Insufficient Funds',
              `You cannot afford VIP for ${durationDays} day(s).\n` +
                `Your balance: **$${formatNumberToReadableString(
                  user.balance
                )}**\n` +
                `You can afford VIP for up to **${affordableDays} day(s)**.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral })

      const durationMs = durationSeconds * 1000
      const guild = interaction.guild!
      const categoryId = guildConfiguration.vipSettings.categoryId
      const vipRoleId = guildConfiguration.vipSettings.roleId

      const channel = await guild.channels.create({
        name: `vip-${interaction.user.username}`,
        type: 0, // GUILD_TEXT
        parent: categoryId,
      })

      await channel.permissionOverwrites.edit(interaction.user.id, {
        ViewChannel: true,
        SendMessages: true,
      })

      const expiresAt = new Date(Date.now() + durationMs)
      const vipChannelCreatedMsg = await channel.send({
        embeds: [
          createInfoEmbed(
            'VIP Channel Ready',
            `Your channel <#${channel.id}> is valid until <t:${Math.floor(
              expiresAt.getTime() / 1000
            )}:f>`
          ),
        ],
      })

      await vipChannelCreatedMsg.pin()

      await channel.send(`Welcome to your VIP channel, ${interaction.user}! 🎉`)

      const member = await guild.members.fetch(interaction.user.id)
      await member.roles.add(vipRoleId, 'VIP purchased via /vip buy')

      const vip = new VipRoom({
        userId: interaction.user.id,
        guildId: interaction.guildId!,
        channelId: channel.id,
        expiresAt,
      })
      await vip.save()

      // odečteme peníze z účtu
      user.balance -= totalPrice
      await user.save()

      return interaction.editReply({
        embeds: [
          createSuccessEmbed(
            'VIP Purchased',
            `Your VIP room <#${channel.id}> has been created for **${durationDays} day(s)**.\n` +
              `You have been charged **$${formatNumberToReadableString(
                totalPrice
              )}**.`
          ),
        ],
      })
    }
  } catch (error) {
    console.error('Error running /vip:', error)
    return interaction.reply({
      embeds: [createErrorEmbed('Internal Error', 'Something went wrong.')],
      flags: MessageFlags.Ephemeral,
    })
  }
}
