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
  checkValidBet,
} from '../../../utils/utils'
import { spinRouletteWheel } from '../../../utils/casinoHelpers'
import {
  getRouletteColor,
  RouletteBet,
  calculateRouletteWin,
  inferTypeFromValue,
  RouletteBetType,
} from '../../../utils/rouletteUtils'

export const data: CommandData = {
  name: 'roulette',
  description: 'Play American roulette with multiple bets!',
  options: [
    {
      name: 'bets',
      description: 'Your bets (e.g., "100 red, 50 17, 200 d2, 75 c1")',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'spins',
      description: 'Number of spins.',
      type: ApplicationCommandOptionType.Integer,
      required: false,
      choices: Array.from({ length: 10 }, (_, i) => ({
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
  devOnly: true,
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
    const betsInput = interaction.options.getString('bets', true)
    const showBalance = interaction.options.getBoolean('show-balance') || false

    const bets: RouletteBet[] = []

    for (const betStr of betsInput.split(',')) {
      const [amountStr, value] = betStr.trim().split(/\s+/)
      if (!amountStr || !value) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Invalid Input - Invalid Bet Format',
              `Each bet must be in the format: "<amount> <value>". Invalid: "${betStr.trim()}"`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const amount = parseReadableStringToNumber(amountStr)

      // Validate numeric amount
      const isBetValid = checkValidBet(
        interaction,
        amount,
        // configReply.casinoSettings?.roulette.maxBet || 0,
        // configReply.casinoSettings?.roulette.minBet || 0,
        0,
        0,
        user.balance,
        spins
      )

      if (!isBetValid) return

      let type: RouletteBetType
      try {
        type = inferTypeFromValue(value)
      } catch (e: any) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Invalid Input - Invalid Bet Value',
              `Invalid bet value: "${value}"\n${e.message}`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      bets.push({ amount, type, value })
    }

    if (bets.length === 0) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - No Bets Found',
            'Please provide at least one valid bet.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const totalBet = bets.reduce((sum, b) => sum + b.amount, 0)
    let totalNet = 0
    const resultsMap: Record<string, string[]> = {}

    // Run spins
    for (let i = 0; i < spins; i++) {
      const spinResult = spinRouletteWheel()
      const color = getRouletteColor(spinResult)
      const key = `${color} ${spinResult}`

      if (!resultsMap[key]) resultsMap[key] = []

      for (const bet of bets) {
        const winnings = calculateRouletteWin(
          bet,
          spinResult,
          configReply.casinoSettings.roulette.winMultipliers
        )
        const net = winnings - bet.amount
        totalNet += net

        resultsMap[key].push(
          `- Bet: $${formatNumberToReadableString(bet.amount)} on ${
            bet.value
          } → ${
            net > 0
              ? `🎉 +$${formatNumberToReadableString(net)}`
              : net < 0
              ? `❌ -$${formatNumberToReadableString(bet.amount)}`
              : '$0'
          }`
        )
      }
    }

    // Prepare final results string
    const results: string[] = []
    for (const [spin, betsArr] of Object.entries(resultsMap)) {
      results.push(`${spin}\n${betsArr.join('\n')}`)
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
            `🎲 **Spin Results:**\n${results.join('\n\n')}\n\n` +
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
    console.error('Error running roulette command:', error)
    return interaction.reply({
      embeds: [
        createErrorEmbed(
          'Error',
          'An unexpected error occurred while processing your bet.'
        ),
      ],
      flags: MessageFlags.Ephemeral,
    })
  }
}
