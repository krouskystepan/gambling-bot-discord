import { shouldAnnounceByMultiplier } from 'gambling-bot-shared/casino'
import {
  formatMoney,
  parseReadableStringToNumber
} from 'gambling-bot-shared/common'

import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import {
  roundCountOption,
  runInstantCasinoCommand,
  showBalanceOption,
  skipAnimationsOption
} from '@/services'
import { spinRouletteWheel } from '@/utils/casino/rng'
import {
  RouletteBet,
  RouletteBetType,
  calculateRouletteWin,
  getRouletteColor,
  inferTypeFromValue
} from '@/utils/casino/roulette'
import { sleep } from '@/utils/common/utils'
import { createBetEmbed, createErrorEmbed } from '@/utils/discord/createEmbed'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'

export const command: CommandData = {
  name: 'roulette',
  description: 'Play Mini Roulette with multiple bets!',
  options: [
    {
      name: 'bets',
      description: 'Your bets (e.g., "100 red, 50 17, 200 d2, 75 c1")',
      type: ApplicationCommandOptionType.String,
      required: true
    },
    roundCountOption('spins', 5, 'Number of spins.'),
    showBalanceOption,
    skipAnimationsOption
  ],
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  await runInstantCasinoCommand<{ bets: RouletteBet[]; spins: number }>({
    interaction,
    game: 'roulette',
    prepareInput: async ({ interaction, guildConfig }) => {
      const spins = interaction.options.getInteger('spins') || 1
      const betsInput = interaction.options.getString('bets', true)
      const bets: RouletteBet[] = []

      for (const betStr of betsInput.split(',')) {
        const [amountStr, rawValue] = betStr.trim().split(/\s+/)
        if (!amountStr || !rawValue) {
          await interaction.reply({
            embeds: [
              createErrorEmbed(
                'Invalid Input - Invalid Bet Format',
                `Each bet must be in the format: "<amount> <value>". Invalid: "${betStr.trim()}"`
              )
            ],
            flags: MessageFlags.Ephemeral
          })
          return { ok: false }
        }

        const amount = parseReadableStringToNumber(amountStr)

        let type: RouletteBetType
        try {
          type = inferTypeFromValue(rawValue)
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Unknown error'

          await interaction.reply({
            embeds: [
              createErrorEmbed('Invalid Input - Invalid Bet Value', message)
            ],
            flags: MessageFlags.Ephemeral
          })
          return { ok: false }
        }

        let value = rawValue
        const displayValue = value

        if (type === 'dozen') value = value[1]
        if (type === 'column') value = value[1]

        bets.push({ amount, type, value, displayValue })
      }

      if (bets.length === 0) {
        await interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid Input - No Bets Found',
              'Please provide at least one valid bet.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
        return { ok: false }
      }

      const totalOneSpin = bets.reduce((sum, b) => sum + b.amount, 0)

      return {
        ok: true,
        totalBet: totalOneSpin * spins,
        validateBetAmount: totalOneSpin,
        minBet: guildConfig.casinoSettings.roulette.minBet,
        maxBet: guildConfig.casinoSettings.roulette.maxBet,
        input: { bets, spins }
      }
    },
    executeGame: async ({
      interaction,
      guildConfig,
      betId,
      totalBet,
      showBalance,
      skipAnimations,
      input: { bets, spins }
    }) => {
      let totalWinnings = 0
      let liveResult = 0
      const results: string[] = []
      const announcementHits: string[] = []

      for (let i = 0; i < spins; i++) {
        if (!skipAnimations) {
          await interaction.editReply({
            embeds: [
              createBetEmbed(
                '🌀 Spinning...',
                'Blue',
                `💵 Total Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**\n\n` +
                  `🕹 Spin Results:\n${results.join('\n\n')}\n\n` +
                  `💰 Total: ${
                    liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                  } **${formatMoney(liveResult, guildConfig.globalSettings)}**`,
                betId
              )
            ]
          })

          await sleep(700)
        }

        const spinResult = spinRouletteWheel()
        const color = getRouletteColor(spinResult)
        let spinOutput = `**${color} ${spinResult}**`
        let winnings = 0

        for (const bet of bets) {
          const winAmount = calculateRouletteWin(
            bet,
            spinResult,
            guildConfig.casinoSettings.roulette.winMultipliers
          )

          winnings += winAmount

          if (winAmount > 0) {
            const betMultiplier = winAmount / bet.amount
            if (
              shouldAnnounceByMultiplier(
                betMultiplier,
                guildConfig.casinoSettings.winAnnouncements
                  .rouletteMinMultiplier
              )
            ) {
              announcementHits.push(
                formatBigWinLine({
                  label: `Spin **${i + 1}**`,
                  middle: [
                    `**${color} ${spinResult}**`,
                    `**${bet.displayValue ?? bet.value}**`
                  ],
                  multiplier: betMultiplier.toFixed(2),
                  payout: formatMoney(winAmount, guildConfig.globalSettings),
                  bet: formatMoney(bet.amount, guildConfig.globalSettings)
                })
              )
            }
          }

          spinOutput += `\n**${formatMoney(bet.amount, guildConfig.globalSettings)}** on ${
            bet.displayValue ?? bet.value
          } | ${
            winAmount > 0
              ? `🎉 | +${formatMoney(winAmount, guildConfig.globalSettings)}`
              : `❌ | -${formatMoney(bet.amount, guildConfig.globalSettings)}`
          }`
        }

        totalWinnings += winnings
        const totalBetPerSpin = bets.reduce((sum, b) => sum + b.amount, 0)
        liveResult += winnings - totalBetPerSpin
        results.push(spinOutput)
      }

      const isWin = liveResult > 0
      const isLoss = liveResult < 0

      return {
        totalWinnings,
        announce: {
          game: 'roulette',
          lines: announcementHits,
          sourceChannelId: interaction.channelId
        },
        buildFinalEmbed: (finalBalance) =>
          createBetEmbed(
            isWin
              ? '🌀 **Win!** 🎉'
              : isLoss
                ? '🌀 **Better Luck Next Time...** ❌'
                : '🌀 **Not Bad...** 👀',
            isWin ? 'Green' : isLoss ? 'Red' : 'Yellow',
            `💵 Total Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**\n\n` +
              `🕹 **Spin Results:**\n${results.join('\n\n')}\n\n` +
              `💰 Total: ${
                isWin ? '🟢' : isLoss ? '🔴' : '🟡'
              } **${formatMoney(liveResult, guildConfig.globalSettings)}**\n` +
              (showBalance
                ? `🏦 Balance: **${formatMoney(finalBalance, guildConfig.globalSettings)}**`
                : ''),
            betId
          )
      }
    }
  })
}
