import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'
import {
  createBetEmbed,
  createErrorEmbed,
  createInfoEmbed,
} from '../../../utils/createEmbed'
import {
  checkChannelConfiguration,
  checkUserRegistration,
  formatNumberToReadableString,
  parseReadableStringToNumber,
} from '../../../utils/utils'
import { drawGoldenJackpot } from '../../../utils/casinoHelpers'

const GOLDEN_JACKPOT_MAX_ENTRIES = 100

export const data: CommandData = {
  name: 'goldenjackpot',
  description: `Try your luck at the Golden Jackpot HUGEx!`,
  options: [
    {
      name: 'bet',
      description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'entries',
      description: `Number of entries (max is ${GOLDEN_JACKPOT_MAX_ENTRIES}).`,
      type: ApplicationCommandOptionType.Integer,
      required: false,
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

    if (!configReply) return

    const entries = interaction.options.getInteger('entries') || 1
    const betAmount = interaction.options.getString('bet', true)
    const parsedBetAmount = parseReadableStringToNumber(betAmount)
    const showBalance = interaction.options.getBoolean('show-balance')

    if (entries > GOLDEN_JACKPOT_MAX_ENTRIES || entries < 1) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Entries',
            `The number of entries must be between 1 and ${GOLDEN_JACKPOT_MAX_ENTRIES}.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

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

    if (
      configReply.goldenJackpot.maxBet > 0 &&
      parsedBetAmount > configReply.goldenJackpot.maxBet
    ) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Above Maximum Bet',
            `The maximum bet is **$${formatNumberToReadableString(
              configReply.goldenJackpot.maxBet
            )}**.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (
      configReply.goldenJackpot.minBet > 0 &&
      parsedBetAmount < configReply.goldenJackpot.minBet
    ) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Below Minimum Bet',
            `The minimum bet is **$${formatNumberToReadableString(
              configReply.goldenJackpot.minBet
            )}**.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const totalBet = parsedBetAmount * entries
    if (user.balance < totalBet) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Insufficient Funds',
            `You don't have enough money to place this bet for ${entries} entries (you need **$${formatNumberToReadableString(
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

    for (let i = 0; i < entries; i++) {
      const jackpotNumber = drawGoldenJackpot(configReply.goldenJackpot)
      const isJackpot = jackpotNumber === 1
      const winnings = isJackpot
        ? parsedBetAmount * configReply.goldenJackpot.winMultiplier
        : 0

      if (isJackpot) {
        results.push(
          `**JACKPOT!** You won **$${formatNumberToReadableString(
            winnings
          )}** on Try **#${(i + 1).toString().padStart(3, '0')}**! 🔥`
        )
      }

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
            ? '🤑 **JACKPOT!** 🎉'
            : isLoss
            ? '🤑 **Better Luck Next Time...** ❌'
            : '🤑 **Not Bad...** 👀',
          isWin ? 'Green' : isLoss ? 'Red' : 'Yellow',
          `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
            `🤑 **Draw Result:**${
              isWin ? `\n ${results.join('\n')}` : ' No win'
            }\n\n` +
            `💰 Total: ${
              isWin ? '🟢' : isLoss ? '🔴' : '🟡'
            } **$${formatNumberToReadableString(totalWinnings)}**\n` +
            (showBalance
              ? `🏦 Balance: **$${formatNumberToReadableString(user.balance)}**`
              : '')
        ),
      ],
    })
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
