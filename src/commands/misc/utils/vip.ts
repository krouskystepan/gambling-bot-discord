import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import {
  ApplicationCommandOptionType,
  ChannelType,
  MessageFlags,
} from 'discord.js'
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
import Transaction from '../../../models/Transaction'

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
      name: 'extend',
      description: 'Extend your current VIP duration.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'duration',
          description: 'Extra duration to add (e.g., 2d, 1w)',
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
      guildConfiguration.vipSettings.pricePerDay === 0
    ) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'VIP Not Configured',
            'VIP category or price is not set yet. Please contact administrator.'
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
    const pricePerCreate = guildConfiguration.vipSettings.pricePerCreate

    if (subcommand === 'info') {
      const maxDays = Math.floor(user.balance / pricePerDay)
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'VIP Info',
            (pricePerCreate > 0
              ? `Price per create: **$${formatNumberToReadableString(
                  pricePerCreate
                )}**\n`
              : '') +
              `Price per day: **$${formatNumberToReadableString(
                pricePerDay
              )}**\n\n` +
              `Your balance: **$${formatNumberToReadableString(
                user.balance
              )}**\n` +
              `You can afford VIP for up to **${maxDays} day(s)** (excluding creation fee).`
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

      if (!/^(\d+[dw])+$/i.test(durationInput)) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Invalid Input - Invalid Format',
              'Duration format is invalid. Use whole numbers only, e.g., 1d, 2w.'
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

      const durationDays = durationSeconds / 86400
      let totalPrice = durationDays * pricePerDay

      if (pricePerCreate > 0) {
        totalPrice += pricePerCreate
      }

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
                (pricePerCreate > 0
                  ? `Creation fee: **$${formatNumberToReadableString(
                      pricePerCreate
                    )}**\n`
                  : '') +
                `You can afford VIP for up to **${affordableDays} day(s)** (excluding creation fee).`
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

      const now = new Date()
      const day = now.getDate().toString().padStart(2, '0')
      const month = (now.getMonth() + 1).toString().padStart(2, '0')

      const channel = await guild.channels.create({
        name: `vip-${interaction.user.username}-${day}-${month}`,
        type: ChannelType.GuildText,
        parent: categoryId,
      })

      await channel.permissionOverwrites.edit(interaction.user.id, {
        ViewChannel: true,
        SendMessages: true,
      })

      const expiresAt = new Date(Date.now() + durationMs)
      const vipChannelCreatedMsg = await channel.send({
        content: `Welcome to your VIP channel, ${interaction.user}! 🎉`,
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

      const member = await guild.members.fetch(interaction.user.id)
      await member.roles.add(vipRoleId, 'VIP purchased via /vip buy')

      const vip = new VipRoom({
        userId: interaction.user.id,
        guildId: interaction.guildId!,
        channelId: channel.id,
        expiresAt,
      })
      await vip.save()

      user.balance -= totalPrice
      await user.save()

      await Transaction.create({
        userId: user.userId,
        guildId: user.guildId,
        amount: totalPrice,
        type: 'vip',
        source: 'system',
        meta: {
          action: 'buy',
          durationDays: durationDays,
        },
        createdAt: new Date(),
      })

      return interaction.editReply({
        embeds: [
          createSuccessEmbed(
            'VIP Purchased',
            `Your VIP room <#${channel.id}> has been created for **${durationDays} day(s)**.\n` +
              `You have been charged **$${formatNumberToReadableString(
                totalPrice
              )}**.` +
              (pricePerCreate > 0
                ? ` (including a creation fee of **$${formatNumberToReadableString(
                    pricePerCreate
                  )}**)`
                : '')
          ),
        ],
      })
    }

    if (subcommand === 'extend') {
      const existingVip = await VipRoom.findOne({
        userId: interaction.user.id,
        guildId: interaction.guildId!,
        expiresAt: { $gt: new Date() },
      })

      if (!existingVip) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'VIP Not Active',
              'You do not currently have an active VIP to extend.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const durationInput = interaction.options.getString('duration', true)

      if (!/^(\d+[dw])+$/i.test(durationInput)) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Invalid Input - Invalid Format',
              'Duration format is invalid. Use whole numbers only, e.g., 1d, 2w.'
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

      const durationDays = durationSeconds / 86400
      const totalPrice = durationDays * pricePerDay
      const affordableDays = Math.floor(user.balance / pricePerDay)

      if (user.balance < totalPrice) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Insufficient Funds',
              `You cannot afford to extend VIP for ${durationDays} day(s).\n` +
                `Your balance: **$${formatNumberToReadableString(
                  user.balance
                )}**\n` +
                `You can afford VIP for up to **${affordableDays} day(s)**.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      existingVip.expiresAt = new Date(
        existingVip.expiresAt.getTime() + durationSeconds * 1000
      )
      await existingVip.save()

      user.balance -= totalPrice
      await user.save()

      await Transaction.create({
        userId: user.userId,
        guildId: user.guildId,
        amount: totalPrice,
        type: 'vip',
        source: 'system',
        meta: {
          action: 'extend',
          durationDays: durationDays,
        },
        createdAt: new Date(),
      })
      const vipChannel = await interaction.guild!.channels.fetch(
        existingVip.channelId
      )

      if (vipChannel?.isTextBased()) {
        const extendMsg = await vipChannel.send({
          content: `Your VIP has been extended, ${interaction.user}! 🎉`,
          embeds: [
            createSuccessEmbed(
              'VIP Channel Extended',
              `New expiry: <t:${Math.floor(
                existingVip.expiresAt.getTime() / 1000
              )}:f>`
            ),
          ],
        })

        await extendMsg.pin()
      }

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'VIP Extended',
            `Your VIP has been extended by **${durationDays} day(s)**.\n` +
              `New expiry: <t:${Math.floor(
                existingVip.expiresAt.getTime() / 1000
              )}:f>\n` +
              `You have been charged **$${formatNumberToReadableString(
                totalPrice
              )}**.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }
  } catch (error) {
    console.error('Error running /vip:', error)
  }
}
