import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import {
  ApplicationCommandOptionType,
  ChannelType,
  CommandInteractionOptionResolver,
  MessageFlags,
} from 'discord.js'
import GuildConfiguration from '../../../models/GuildConfiguration'
import { createInfoEmbed, createSuccessEmbed } from '../../../utils/createEmbed'
import defaultCasinoSettings from '../../../utils/defaultConfig'
import {
  formatNumberToReadableString,
  parseReadableStringToNumber,
} from '../../../utils/utils'

export const data: CommandData = {
  name: 'setup-settings',
  description: 'Manage the casino settings (max, min bets and win %).',
  options: [
    {
      name: 'edit',
      description: 'Edit the games settings.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'game',
          description: 'Game to configure',
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: [
            { name: 'Dice', value: 'dice' },
            { name: 'Coinflip', value: 'coinflip' },
            // { name: 'Slots', value: 'slots' },
            // { name: 'Lottery', value: 'lottery' },
            { name: 'RPS', value: 'rps' },
            { name: 'Golden Jackpot', value: 'goldenJackpot' },
            { name: 'Blackjack', value: 'blackjack' },
          ],
        },
        {
          name: 'key',
          description: 'Select the setting to update.',
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
        {
          name: 'value',
          description:
            'New value. (num: e.g., 1000, 2k, 4.5k | str: e.g., 1:5)',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: 'reset',
      description: 'Reset the casino settings to default values.',
      type: ApplicationCommandOptionType.Subcommand,
    },
    // Add factory reset option
    // Add force add new game option after new update
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

    if (!guildConfiguration || !guildConfiguration.casinoSettings) {
      guildConfiguration = new GuildConfiguration({
        guildId: interaction.guildId,
        casinoSettings: defaultCasinoSettings,
      })
    }

    const options = interaction.options as CommandInteractionOptionResolver

    const subCommand = options.getSubcommand()

    if (subCommand === 'edit') {
      const game = options.getString('game', true)
      const value = options.getString('value', true)
      const parsedValue = parseReadableStringToNumber(value)
      const key = options.getString('key', true)

      if (!guildConfiguration.casinoSettings[game]) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Invalid Game',
              'The game you provided is not valid.\nPlease make sure you enter a valid game name.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      if (!guildConfiguration.casinoSettings[game][key]) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Invalid Setting',
              'The setting you provided is not valid.\nPlease make sure you enter a valid setting name.\n\n> ***Note:** After changing the game a second time within the same command. Please retype the command from scratch to refresh the options. (This is a Discord API bug).*'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      if (typeof guildConfiguration.casinoSettings[game][key] === 'number') {
        if (isNaN(parsedValue)) {
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

        if (parsedValue <= 0) {
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

        if (
          key === 'minBet' &&
          parsedValue > guildConfiguration.casinoSettings[game].maxBet
        ) {
          return interaction.reply({
            embeds: [
              createInfoEmbed(
                'Invalid Input - Above Maximum Bet',
                `The minimum bet cannot be greater than the maximum bet of **$${formatNumberToReadableString(
                  guildConfiguration.casinoSettings[game].maxBet
                )}**.`
              ),
            ],
            flags: MessageFlags.Ephemeral,
          })
        }

        guildConfiguration.casinoSettings[game][key] = parsedValue

        await interaction.reply({
          embeds: [
            createSuccessEmbed(
              'Casino Settings Updated',
              `The setting ${key} for ${game} has been updated to **${formatNumberToReadableString(
                parsedValue
              )}**.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })

        await interaction.followUp({
          embeds: [
            createInfoEmbed(
              'Current Casino Settings',
              `The current settings for ${game} are:\n\n${Object.entries(
                guildConfiguration.casinoSettings[game]
              )
                .map(
                  ([key, value]) =>
                    `**${key
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/^./, (str) =>
                        str.toUpperCase()
                      )}:** ${formatNumberToReadableString(
                      parseInt(value as string)
                    )}`
                )
                .join('\n')}`
            ),
          ],
          ephemeral: true,
        })
      } else {
        // guildConfiguration.casinoSettings[game][key] = value

        await interaction.reply({
          embeds: [
            createSuccessEmbed(
              'Casino Settings Updated',
              `Not Implemented yet.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      guildConfiguration.markModified('casinoSettings')

      await guildConfiguration.save()
    }

    if (subCommand === 'reset') {
      guildConfiguration.casinoSettings = defaultCasinoSettings

      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Casino Settings Reset',
            'The casino settings have been reset to the default values. Use command `/casino-info` to view the current settings.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
