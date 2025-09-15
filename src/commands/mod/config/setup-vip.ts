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
      name: 'set-price-per-day',
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
    {
      name: 'set-create-price',
      description: 'Set the one-time price for creating a VIP room.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'price',
          description: 'One-time price in your currency.',
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
  deleted: true,
  devOnly: true,
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
      if (!category) return

      if (guildConfiguration.vipSettings.categoryId === category.id) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'VIP Setup - Add Category',
              `Category <#${category.id}> is already set for VIP rooms.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      guildConfiguration.vipSettings.categoryId = category.id
      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'VIP Setup - Add Category',
            `Category <#${category.id}> has been successfully set for VIP rooms.`
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
      if (!role) return

      if (guildConfiguration.vipSettings.roleId === role.id) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'VIP Setup - Add Role',
              `Role <@&${role.id}> is already set as VIP role.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      guildConfiguration.vipSettings.roleId = role.id
      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'VIP Setup - Add Role',
            `Role <@&${role.id}> has been successfully set as VIP role.`
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

    if (subcommand === 'set-price-per-day') {
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
            'VIP Setup - Set Price Per Day',
            `Price per day for VIP access has been set to **${price}**.`
          ),
        ],
      })
    }

    if (subcommand === 'set-create-price') {
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

      if (parsedBetAmount < 0) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Invalid Input - Negative number',
              'The number you provided cannot be negative.\nPlease enter 0 or a positive value.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      guildConfiguration.vipSettings.pricePerCreate = parsedBetAmount
      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'VIP Setup - Set Create Price',
            `Creation fee for VIP rooms has been set to **${price}**.`
          ),
        ],
      })
    }
  } catch (error) {
    console.error('Error running /setup-vip:', error)
  }
}
