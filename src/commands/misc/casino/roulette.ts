import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'
import {
  createBetEmbed,
  createErrorEmbed,
  createInfoEmbed,
} from '../../../utils/createEmbed'
import {
  checkUserRegistration,
  parseReadableStringToNumber,
  formatNumberToReadableString,
  checkChannelConfiguration,
} from '../../../utils/utils'
import { spinRouletteWheel } from '../../../utils/casinoHelpers'
import {
  AMERICAN_NUMBERS,
  calculateRouletteWin,
  RouletteBet,
  RouletteBetType,
} from '../../../utils/rouletteUtils'

export const data: CommandData = {
  name: 'roulette',
  description: 'Play American roulette!',
  options: [
    {
      name: 'bet',
      description: 'Your bet amount (e.g., 100, 1k, 5k).',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'type',
      description: 'Bet type: number, color, parity, range, dozen, column',
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: 'Number', value: 'number' },
        { name: 'Color', value: 'color' },
        { name: 'Parity', value: 'parity' },
        { name: 'Range', value: 'range' },
        { name: 'Dozen', value: 'dozen' },
        { name: 'Column', value: 'column' },
      ],
    },
    {
      name: 'value',
      description: 'Your bet value (number, red/black, even/odd, etc.)',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  dm_permission: false,
}

export const options: CommandOptions = {
  deleted: true,
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    const user = await checkUserRegistration(
      interaction.user.id,
      interaction.guildId!
    )

    if (!user)
      return interaction.reply({
        embeds: [createErrorEmbed('Not Registered', 'Use `/register` first.')],
        flags: MessageFlags.Ephemeral,
      })

    const configReply = await checkChannelConfiguration(
      interaction,
      'casinoChannelIds',
      {
        notSet: 'Casino not configured yet.',
        notAllowed: 'This channel is not allowed.',
      }
    )
    if (!configReply) return

    const betAmountStr = interaction.options.getString('bet', true)
    const betAmount = parseReadableStringToNumber(betAmountStr)

    if (isNaN(betAmount)) {
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

    if (betAmount <= 0) {
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

    if (betAmount > user.balance)
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Insufficient Funds',
            `Your balance is $${formatNumberToReadableString(
              user.balance
            )}, cannot bet $${formatNumberToReadableString(betAmount)}`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })

    const betType = interaction.options.getString(
      'type',
      true
    ) as RouletteBetType
    const betValue = interaction.options.getString('value', true)

    switch (betType) {
      case 'number':
        if (!AMERICAN_NUMBERS.includes(betValue))
          return interaction.reply({
            embeds: [
              createInfoEmbed(
                'Invalid Input - Invalid Number',
                'Choose a valid number: 0, 00, or 1–36'
              ),
            ],
            flags: MessageFlags.Ephemeral,
          })
        break
      case 'color':
        if (!['red', 'black'].includes(betValue.toLowerCase()))
          return interaction.reply({
            embeds: [
              createInfoEmbed(
                'Invalid Input - Invalid Color',
                'Choose red or black'
              ),
            ],
            flags: MessageFlags.Ephemeral,
          })
        break
      case 'parity':
        if (!['even', 'odd'].includes(betValue.toLowerCase()))
          return interaction.reply({
            embeds: [
              createInfoEmbed(
                'Invalid Input - Invalid Parity',
                'Choose even or odd'
              ),
            ],
            flags: MessageFlags.Ephemeral,
          })
        break
      case 'range':
        if (!['low', 'high'].includes(betValue.toLowerCase()))
          return interaction.reply({
            embeds: [
              createInfoEmbed(
                'Invalid Input - Invalid Range',
                'Choose low (1–18) or high (19–36)'
              ),
            ],
            flags: MessageFlags.Ephemeral,
          })
        break
      case 'dozen':
        if (!['1', '2', '3'].includes(betValue))
          return interaction.reply({
            embeds: [
              createInfoEmbed(
                'Invalid Input - Invalid Dozen',
                'Choose 1 (1–12), 2 (13–24), or 3 (25–36)'
              ),
            ],
            flags: MessageFlags.Ephemeral,
          })
        break
      case 'column':
        if (!['1', '2', '3'].includes(betValue))
          return interaction.reply({
            embeds: [
              createInfoEmbed(
                'Invalid Input - Invalid Column',
                'Choose 1, 2, or 3'
              ),
            ],
            flags: MessageFlags.Ephemeral,
          })
        break
    }

    const rouletteBet: RouletteBet = { type: betType, value: betValue }
    const result = spinRouletteWheel()
    const winnings = calculateRouletteWin(rouletteBet, result, betAmount)

    user.balance += winnings - betAmount
    await user.save()

    const isWin = winnings > 0
    const isLoss = winnings < 0

    const showBalance = true

    return interaction.reply({
      embeds: [
        createBetEmbed(
          isWin
            ? '🔄 **Win!** 🎉'
            : isLoss
            ? '🔄 **Better Luck Next Time...** ❌'
            : '🔄 **Not Bad...** 👀',
          isWin ? 'Green' : isLoss ? 'Red' : 'Yellow',
          `💵 Total Bet: **$${formatNumberToReadableString(betAmount)}**\n\n` +
            `🔄 Bet Type: **${betType}** | Value: **${betValue}**\n` +
            `🟢 Result: **${result}**\n` +
            `💰 Total: ${
              isWin ? '🟢' : isLoss ? '🔴' : '🟡'
            } **$${formatNumberToReadableString(winnings)}**\n` +
            (showBalance
              ? `🏦 Balance: **$${formatNumberToReadableString(user.balance)}**`
              : '')
        ),
      ],
    })
  } catch (err) {
    console.error('Roulette command error:', err)
  }
}
