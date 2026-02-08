import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  checkCasinoChannels,
  checkUserRegistration,
  getUser,
  reserveCasinoBet,
  settleCasinoWinnings
} from '@/services'
import { spinRouletteWheel } from '@/utils/casino/rng'
import {
  RouletteBet,
  RouletteBetType,
  calculateRouletteWin,
  getRouletteColor,
  inferTypeFromValue
} from '@/utils/casino/roulette'
import { isUserOnCooldown } from '@/utils/common/userCooldown'
import {
  checkValidBet,
  formatNumberToReadableString,
  generateId,
  parseReadableStringToNumber
} from '@/utils/common/utils'
import { createBetEmbed, createErrorEmbed } from '@/utils/discord/createEmbed'

export const data: CommandData = {
  name: 'roulette',
  description: 'Play Mini Roulette with multiple bets!',
  options: [
    {
      name: 'bets',
      description: 'Your bets (e.g., "100 red, 50 17, 200 d2, 75 c1")',
      type: ApplicationCommandOptionType.String,
      required: true
    },
    {
      name: 'spins',
      description: 'Number of spins.',
      type: ApplicationCommandOptionType.Integer,
      required: false,
      choices: Array.from({ length: 5 }, (_, i) => ({
        name: (i + 1).toString(),
        value: i + 1
      }))
    },
    {
      name: 'show-balance',
      description:
        'Displays the current balance (WARNING: VISIBLE TO EVERYONE)!',
      type: ApplicationCommandOptionType.Boolean,
      required: false
    },
    {
      name: 'skip-animations',
      description: 'Skip game animations for faster results.',
      type: ApplicationCommandOptionType.Boolean,
      required: false
    }
  ],
  dm_permission: false
}

export const options: CommandOptions = {
  deleted: false
}

export async function run({ interaction }: SlashCommandProps) {
  let betSettled = false

  let userId: string | null = null
  let guildId: string | null = null
  let totalBet = 0
  let totalWinnings = 0
  let betId: string | null = null

  try {
    const user = await checkUserRegistration({ interaction })
    if (!user) return
    userId = user.userId
    guildId = user.guildId

    if (isUserOnCooldown(user.userId)) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Slow Down',
            'Wait a moment before starting another game.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const configReply = await checkCasinoChannels(interaction)
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
            createErrorEmbed(
              'Invalid Input - Invalid Bet Format',
              `Each bet must be in the format: "<amount> <value>". Invalid: "${betStr.trim()}"`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const amount = parseReadableStringToNumber(amountStr)

      let type: RouletteBetType
      try {
        type = inferTypeFromValue(rawValue)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error'

        return interaction.reply({
          embeds: [
            createErrorEmbed('Invalid Input - Invalid Bet Value', message)
          ],
          flags: MessageFlags.Ephemeral
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
          createErrorEmbed(
            'Invalid Input - No Bets Found',
            'Please provide at least one valid bet.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const totalOneSpin = bets.reduce((sum, b) => sum + b.amount, 0)

    const isBetValid = checkValidBet(
      interaction,
      totalOneSpin,
      configReply.casinoSettings.roulette.maxBet,
      configReply.casinoSettings.roulette.minBet
    )
    if (!isBetValid) return

    totalBet = totalOneSpin * spins
    betId = generateId()

    try {
      await reserveCasinoBet({
        userId,
        guildId,
        totalBet,
        betId
      })
    } catch (err) {
      if (err instanceof Error && err.message === 'INSUFFICIENT_FUNDS') {
        const freshUser = await getUser({
          userId,
          guildId
        })

        return await interaction.reply({
          embeds: [
            createErrorEmbed(
              'Insufficient Funds',
              `You don't have enough money to place this bet.\nYour current balance is **$${formatNumberToReadableString(freshUser?.balance ?? 0)}**.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }
      throw err
    }

    let liveResult = 0
    const results: string[] = []

    await interaction.deferReply()

    for (let i = 0; i < spins; i++) {
      if (!skipAnimations) {
        await interaction.editReply({
          embeds: [
            createBetEmbed(
              '🌀 Spinning...',
              'Blue',
              `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
                `🕹 Spin Results:\n${results.join('\n\n')}\n\n` +
                `💰 Total: ${
                  liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                } **$${formatNumberToReadableString(liveResult)}**`,
              betId
            )
          ]
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

    const finalBalance = await settleCasinoWinnings({
      userId,
      guildId,
      totalBet,
      winnings: totalWinnings,
      betId
    })
    betSettled = true

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
              ? `🏦 Balance: **$${formatNumberToReadableString(finalBalance)}**`
              : ''),
          betId
        )
      ]
    })
  } catch (error) {
    if (!betSettled && userId && guildId && betId) {
      try {
        await settleCasinoWinnings({
          userId,
          guildId,
          totalBet,
          winnings: totalWinnings,
          betId
        })
      } catch {}
    }

    await handleUnexpectedInteractionError(interaction, error)
  }
}
