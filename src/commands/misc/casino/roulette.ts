import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'
import {
  createBetEmbed,
  createErrorEmbed,
  createInfoEmbed,
} from '../../../utils/createEmbed'
import {
  checkChannelConfiguration,
  parseReadableStringToNumber,
  formatNumberToReadableString,
  checkUserRegistration,
} from '../../../utils/utils'
import { spinRouletteWheel } from '../../../utils/casinoHelpers'
import {
  AMERICAN_NUMBERS,
  calculateRouletteWin,
  getRouletteColor,
  RouletteBet,
  RouletteBetType,
} from '../../../utils/rouletteUtils'

export const data: CommandData = {
  name: 'roulette',
  description: 'Play American roulette!',
  options: [
    {
      name: 'bet',
      description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
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
          'This server has not been configured for betting commands yet.\nSet it up using web dashboard.',
        notAllowed: `This channel is not configured for betting commands.\nTry one of these channels:`,
      }
    )
    if (!configReply) return

    const spins = interaction.options.getInteger('spins') || 1
    const betType = interaction.options.getString(
      'type',
      true
    ) as RouletteBetType
    const betValue = interaction.options.getString('value', true)
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

    // ✅ validate bet value depending on betType
    switch (betType) {
      case 'number':
        if (!AMERICAN_NUMBERS.includes(betValue))
          return interaction.reply({
            embeds: [
              createInfoEmbed(
                'Invalid Number',
                'Choose a valid number: 0, 00, or 1–36'
              ),
            ],
            flags: MessageFlags.Ephemeral,
          })
        break
      case 'color':
        if (!['red', 'black'].includes(betValue.toLowerCase()))
          return interaction.reply({
            embeds: [createInfoEmbed('Invalid Color', 'Choose red or black')],
            flags: MessageFlags.Ephemeral,
          })
        break
      case 'parity':
        if (!['even', 'odd'].includes(betValue.toLowerCase()))
          return interaction.reply({
            embeds: [createInfoEmbed('Invalid Parity', 'Choose even or odd')],
            flags: MessageFlags.Ephemeral,
          })
        break
      case 'range':
        if (!['low', 'high'].includes(betValue.toLowerCase()))
          return interaction.reply({
            embeds: [
              createInfoEmbed(
                'Invalid Range',
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
                'Invalid Dozen',
                'Choose 1 (1–12), 2 (13–24), or 3 (25–36)'
              ),
            ],
            flags: MessageFlags.Ephemeral,
          })
        break
      case 'column':
        if (!['1', '2', '3'].includes(betValue))
          return interaction.reply({
            embeds: [createInfoEmbed('Invalid Column', 'Choose 1, 2, or 3')],
            flags: MessageFlags.Ephemeral,
          })
        break
    }

    let totalNet = 0
    let results: string[] = []

    for (let i = 0; i < spins; i++) {
      const result = spinRouletteWheel()
      let displayResult = result
      if (/^\d+$/.test(result)) {
        const num = parseInt(result, 10)
        displayResult = num.toString().padStart(2, '0')
      }
      const color = getRouletteColor(result)
      const rouletteBet: RouletteBet = { type: betType, value: betValue }
      const winnings = calculateRouletteWin(
        rouletteBet,
        result,
        parsedBetAmount
      )
      const net = winnings - parsedBetAmount

      results.push(
        `**${color} ${displayResult}** | ${
          net > 0 ? '🎉' : net < 0 ? '❌' : '—'
        } | ${
          net > 0
            ? `**+$${formatNumberToReadableString(net)}**`
            : net < 0
            ? `**-$${readableBetAmount}**`
            : `**$0**`
        }`
      )

      totalNet += net
    }

    user.balance += totalNet
    await user.save()

    const isWin = totalNet > 0
    const isLoss = totalNet < 0

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
            `🎲 **Spin Results:**\n${results.join('\n')}\n\n` +
            `💰 Total: ${
              isWin ? '🟢' : isLoss ? '🔴' : '🟡'
            } **$${formatNumberToReadableString(totalNet)}**\n` +
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
