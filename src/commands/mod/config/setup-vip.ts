import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import {
  ApplicationCommandOptionType,
  ChannelType,
  CommandInteractionOptionResolver,
  MessageFlags,
} from 'discord.js'
import GuildConfiguration from '../../../models/GuildConfiguration'
import VipRoom from '../../../models/VipRoom'
import {
  createErrorEmbed,
  createInfoEmbed,
  createSuccessEmbed,
} from '../../../utils/createEmbed'
import {
  formatNumberToReadableString,
  parseReadableStringToNumber,
} from '../../../utils/utils'

export const data: CommandData = {
  name: 'setup-vip',
  description: 'Manage VIP settings.',
  options: [
    {
      name: 'add-category',
      description: 'Set a category for VIP rooms.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'category',
          description: 'Category to set for VIP rooms.',
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildCategory],
          required: true,
        },
      ],
    },
    {
      name: 'remove-category',
      description: 'Remove the VIP category.',
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: 'add-role',
      description: 'Set a role for VIP users.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'role',
          description: 'Role to assign to VIP users.',
          type: ApplicationCommandOptionType.Role,
          required: true,
        },
      ],
    },
    {
      name: 'remove-role',
      description: 'Remove the VIP role.',
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: 'remove-channel',
      description: 'Remove a specific VIP channel by ID.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel-id',
          description: 'The ID of the VIP channel to remove.',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: 'set-price',
      description: 'Set the price per day for VIP access.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'price',
          description: 'Price per day in your currency.',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
  ],
  dm_permission: false,
}

export const options: CommandOptions = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  deleted: false,
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    let guildConfiguration = await GuildConfiguration.findOne({
      guildId: interaction.guildId,
    })

    if (!guildConfiguration) {
      guildConfiguration = new GuildConfiguration({
        guildId: interaction.guildId,
      })
      await guildConfiguration.save()
    }

    const options = interaction.options as CommandInteractionOptionResolver
    const subcommand = options.getSubcommand()

    if (subcommand === 'add-category') {
      const category = options.getChannel('category')
      guildConfiguration.vipSettings.categoryId = category!.id
      await guildConfiguration.save()
      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'VIP Setup - Add Category',
            `Category <#${
              category!.id
            }> has been successfully set for VIP rooms.`
          ),
        ],
      })
    }

    if (subcommand === 'remove-category') {
      if (!guildConfiguration.vipSettings.categoryId) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'VIP Setup - Remove Category',
              'No VIP category is currently set.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const oldCategory = guildConfiguration.vipSettings.categoryId
      guildConfiguration.vipSettings.categoryId = ''
      await guildConfiguration.save()
      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'VIP Setup - Remove Category',
            `Category <#${oldCategory}> has been removed from VIP settings.`
          ),
        ],
      })
    }

    if (subcommand === 'add-role') {
      const role = options.getRole('role')
      guildConfiguration.vipSettings.roleId = role!.id
      await guildConfiguration.save()
      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'VIP Setup - Add Role',
            `Role <@&${role!.id}> has been successfully set as VIP role.`
          ),
        ],
      })
    }

    if (subcommand === 'remove-role') {
      if (!guildConfiguration.vipSettings.roleId) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'VIP Setup - Remove Role',
              'No VIP role is currently set.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const oldRole = guildConfiguration.vipSettings.roleId
      guildConfiguration.vipSettings.roleId = ''
      await guildConfiguration.save()
      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'VIP Setup - Remove Role',
            `Role <@&${oldRole}> has been removed from VIP settings.`
          ),
        ],
      })
    }

    if (subcommand === 'remove-channel') {
      const channelId = options.getString('channel-id', true)

      const vipRoom = await VipRoom.findOne({
        guildId: interaction.guildId,
        channelId,
      })

      if (!vipRoom) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'VIP Setup - Remove Channel',
              `Channel with ID \`${channelId}\` is not registered as a VIP room.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      await VipRoom.deleteOne({ _id: vipRoom._id })

      const channel = await interaction
        .guild!.channels.fetch(channelId)
        .catch(() => null)
      if (channel) {
        await channel.delete().catch(() => null)
      }

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'VIP Setup - Remove Channel',
            `VIP channel with ID \`${channelId}\` has been removed.`
          ),
        ],
      })
    }

    if (subcommand === 'set-price') {
      const price = options.getString('price', true)
      const parsedBetAmount = parseReadableStringToNumber(price)

      if (isNaN(parsedBetAmount)) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Invalid Input - Not a number',
              'The value you entered is not a valid number.\nPlease make sure you enter a numerical value.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      if (parsedBetAmount <= 0) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Invalid Input - Non-positive number',
              'The number you provided must be greater than 0.\nPlease enter a positive value.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      guildConfiguration.vipSettings.pricePerDay = parsedBetAmount
      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'VIP Setup - Set Price',
            `Price per day for VIP access has been set to **${price}**.`
          ),
        ],
      })
    }
  } catch (error) {
    console.error('Error running /setup-vip:', error)
  }
}
