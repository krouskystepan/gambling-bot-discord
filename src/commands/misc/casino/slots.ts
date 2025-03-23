import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'
import {
  createBetEmbed,
  createErrorEmbed,
  createInfoEmbed,
} from '../../../utils/createEmbed'
import { spinSlot } from '../../../utils/casinoHelpers'
import {
  checkChannelConfiguration,
  parseReadableStringToNumber,
  formatNumberToReadableString,
  checkUserRegistration,
} from '../../../utils/utils'
import { SLOT_MAX_BET, SLOT_MULTIPLIERS } from '../../../utils/casinoConfig'

export const data: CommandData = {
  name: 'slots',
  description: 'Spin the slot machine!',
  options: [
    {
      name: 'bet',
      description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'spins',
      description: 'Number of spins.',
      type: ApplicationCommandOptionType.Integer,
      required: false,
      choices: Array.from({ length: 20 }, (_, i) => ({
        name: (i + 1).toString(),
        value: i + 1,
      })),
    },
    {
      name: 'show-balance',
      description:
        'Displays the current balance (WARNING: VISIBLE TO EVERYONE)!',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
  ],
  dm_permission: false,
}

export const options: CommandOptions = {
  deleted: false,
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    const user = await checkUserRegistration(
      interaction.user.id,
      interaction.guildId!
    )

    if (!user) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Not registered',
            'You are not registered yet.\nUse the `/register` command to register.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const configReply = await checkChannelConfiguration(
      interaction,
      'casinoChannelIds',
      {
        notSet:
          'This server has not been configured for betting commands yet.\nSet it up using `/setup-casino`.',
        notAllowed: `This channel is not configured for betting commands.\nTry one of these channels:`,
      }
    )

    if (configReply) return

    const spins = interaction.options.getInteger('spins') || 1
    const betAmount = interaction.options.getString('bet', true)
    const parsedBetAmount = parseReadableStringToNumber(betAmount)
    const readableBetAmount = formatNumberToReadableString(parsedBetAmount)
    const showBalance = interaction.options.getBoolean('show-balance')

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

    if (SLOT_MAX_BET > 0 && parsedBetAmount > SLOT_MAX_BET) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Above Maximum Bet',
            `The maximum bet is **$${formatNumberToReadableString(
              SLOT_MAX_BET
            )}**.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const totalBet = parsedBetAmount * spins
    if (user.balance < totalBet) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Insufficient Funds',
            `You don't have enough money to place this bet for ${spins} spins (you need **$${formatNumberToReadableString(
              totalBet
            )}**).\nYour current balance is **$${formatNumberToReadableString(
              user.balance
            )}**.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    let totalWinnings = 0
    let results: string[] = []

    for (let i = 0; i < spins; i++) {
      const resultString = spinSlot()
      const winnings = (SLOT_MULTIPLIERS[resultString] || 0) * parsedBetAmount
      const isWin = winnings > 0

      results.push(
        `**${resultString}** | ${isWin ? '🎉' : '❌'} | ${
          isWin
            ? `**+$${formatNumberToReadableString(winnings)}**`
            : `**-$${readableBetAmount}**`
        }`
      )

      totalWinnings += winnings - parsedBetAmount
    }

    user.balance += totalWinnings
    await user.save()

    const isWin = totalWinnings > 0
    const isLoss = totalWinnings < 0

    return interaction.reply({
      embeds: [
        createBetEmbed(
          isWin
            ? '🎰 **Win!** 🎉'
            : isLoss
            ? '🎰 **Better Luck Next Time...** ❌'
            : '🎰 **Not Bad...** 👀',
          isWin ? 'Green' : isLoss ? 'Red' : 'Yellow',
          `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
            `🕹 **Spin Results:**\n${results.join('\n')}\n\n` +
            `💰 Total: ${
              isWin ? '🟢' : isLoss ? '🔴' : '🟡'
            } **$${formatNumberToReadableString(totalWinnings)}**\n` +
            (showBalance
              ? `🏦 Current Balance: **$${formatNumberToReadableString(
                  user.balance
                )}**`
              : '')
        ),
      ],
    })
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
