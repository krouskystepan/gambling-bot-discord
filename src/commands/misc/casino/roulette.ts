import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'
import { createBetEmbed, createErrorEmbed } from '../../../utils/createEmbed'
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
  description: 'Play Mini Roulette with multiple bets!',
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
      choices: Array.from({ length: 5 }, (_, i) => ({
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
    {
      name: 'skip-animations',
      description: 'Skip game animations for faster results.',
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
    const betsInput = interaction.options.getString('bets', true)
    const showBalance = interaction.options.getBoolean('show-balance')
    const skipAnimations = interaction.options.getBoolean('skip-animations')

    const bets: RouletteBet[] = []

    for (const betStr of betsInput.split(',')) {
      const [amountStr, rawValue] = betStr.trim().split(/\s+/)
      if (!amountStr || !rawValue) {
        return interaction.reply({
          embeds: [
            createBetEmbed(
              'Invalid Bet Format',
              'Red',
              `Each bet must be in the format: "<amount> <value>". Invalid: "${betStr.trim()}"`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const amount = parseReadableStringToNumber(amountStr)

      let type: RouletteBetType
      try {
        type = inferTypeFromValue(rawValue)
      } catch (e: any) {
        return interaction.reply({
          embeds: [createBetEmbed('Invalid Bet Value', 'Red', `${e.message}`)],
          flags: MessageFlags.Ephemeral,
        })
      }

      let value = rawValue
      let displayValue = value

      if (type === 'dozen') value = value[1]
      if (type === 'column') value = value[1]

      bets.push({ amount, type, value, displayValue })
    }

    if (bets.length === 0) {
      return interaction.reply({
        embeds: [
          createBetEmbed(
            'No Bets Found',
            'Red',
            'Please provide at least one valid bet.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const totalOneSpin = bets.reduce((sum, b) => sum + b.amount, 0)

    const isBetValid = checkValidBet(
      interaction,
      totalOneSpin,
      configReply.casinoSettings.roulette.maxBet,
      configReply.casinoSettings.roulette.minBet,
      user.balance,
      spins
    )
    if (!isBetValid) return

    const totalBet = totalOneSpin * spins
    user.balance -= totalBet

    let totalWinnings = 0
    let liveResult = 0
    const results: string[] = []

    await interaction.deferReply({ withResponse: true })

    for (let i = 0; i < spins; i++) {
      if (!skipAnimations) {
        await interaction.editReply({
          embeds: [
            createBetEmbed(
              '🌀 Spinning...',
              'Blue',
              `💵 Total Bet: **$${formatNumberToReadableString(
                totalBet
              )}**\n\n` +
                `🕹 Spin Results:\n${results.join('\n\n')}\n\n` +
                `💰 Total: ${
                  liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                } **$${formatNumberToReadableString(liveResult)}**`
            ),
          ],
        })

        await new Promise((res) => setTimeout(res, 700))
      }

      const spinResult = spinRouletteWheel()
      const color = getRouletteColor(spinResult)
      let spinOutput = `**${color} ${spinResult}**`
      let winnings = 0

      for (const bet of bets) {
        const winAmount = calculateRouletteWin(
          bet,
          spinResult,
          configReply.casinoSettings.roulette.winMultipliers
        )

        winnings += winAmount
        spinOutput += `\n**$${formatNumberToReadableString(bet.amount)}** on ${
          bet.displayValue ?? bet.value
        } | ${
          winAmount > 0
            ? `🎉 | +$${formatNumberToReadableString(winAmount)}`
            : `❌ | -$${formatNumberToReadableString(bet.amount)}`
        }`
      }

      totalWinnings += winnings
      const totalBetPerSpin = bets.reduce((sum, b) => sum + b.amount, 0)
      liveResult += winnings - totalBetPerSpin
      results.push(spinOutput)
    }

    user.balance += totalWinnings
    user.netProfit += liveResult
    await user.save()

    const isWin = liveResult > 0
    const isLoss = liveResult < 0

    await interaction.editReply({
      embeds: [
        createBetEmbed(
          isWin
            ? '🌀 **Win!** 🎉'
            : isLoss
            ? '🌀 **Better Luck Next Time...** ❌'
            : '🌀 **Not Bad...** 👀',
          isWin ? 'Green' : isLoss ? 'Red' : 'Yellow',
          `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
            `🕹 **Spin Results:**\n${results.join('\n\n')}\n\n` +
            `💰 Total: ${
              isWin ? '🟢' : isLoss ? '🔴' : '🟡'
            } **$${formatNumberToReadableString(liveResult)}**\n` +
            (showBalance
              ? `🏦 Balance: **$${formatNumberToReadableString(user.balance)}**`
              : '')
        ),
      ],
    })
  } catch (error) {
    console.error('Error running roulette command:', error)
  }
}
