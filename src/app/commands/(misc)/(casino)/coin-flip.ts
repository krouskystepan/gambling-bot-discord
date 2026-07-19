import { shouldAnnounceByMultiplier } from 'gambling-bot-shared/casino'
import {
  formatMoney,
  parseReadableStringToNumber
} from 'gambling-bot-shared/common'

import { ApplicationCommandOptionType } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import {
  betOption,
  roundCountOption,
  runInstantCasinoCommand,
  showBalanceOption,
  skipAnimationsOption
} from '@/services'
import { flipCoin } from '@/utils/casino/rng'
import { sleep } from '@/utils/common/utils'
import { createBetEmbed } from '@/utils/discord/createEmbed'
import { coinEmojis, flipCoinEmote } from '@/utils/discord/customEmotes'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'

export const command: CommandData = {
  name: 'coin-flip',
  description: 'Flip a coin!',
  options: [
    betOption,
    {
      name: 'side',
      description: 'Choose the coin side.',
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: 'Heads', value: 'heads' },
        { name: 'Tails', value: 'tails' }
      ]
    },
    roundCountOption('flips', 10, 'Number of flips.'),
    showBalanceOption,
    skipAnimationsOption
  ],
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  await runInstantCasinoCommand<{
    side: string
    unitBet: number
    flips: number
  }>({
    interaction,
    game: 'coinflip',
    prepareInput: async ({ interaction, guildConfig }) => {
      const flips = interaction.options.getInteger('flips') || 1
      const side = interaction.options.getString('side', true)
      const betAmount = interaction.options.getString('bet', true)
      const unitBet = parseReadableStringToNumber(betAmount)

      return {
        ok: true,
        totalBet: unitBet * flips,
        validateBetAmount: unitBet,
        minBet: guildConfig.casinoSettings.coinflip.minBet,
        maxBet: guildConfig.casinoSettings.coinflip.maxBet,
        input: { side, unitBet, flips }
      }
    },
    executeGame: async ({
      interaction,
      guildConfig,
      betId,
      totalBet,
      showBalance,
      skipAnimations,
      input: { side, unitBet, flips }
    }) => {
      let totalWinnings = 0
      let liveResult = 0
      const results: string[] = []
      const announcementFlips: string[] = []

      for (let i = 0; i < flips; i++) {
        if (!skipAnimations) {
          await interaction.editReply({
            embeds: [
              createBetEmbed(
                `🪙 Flipping...`,
                'Blue',
                `💵 Total Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**\n\n` +
                  `🪙 **Flip Results:**\n${[...results, flipCoinEmote].join('\n')}` +
                  `\n\n💰 Total: ${
                    liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                  } **${formatMoney(liveResult, guildConfig.globalSettings)}**`,
                betId
              )
            ]
          })

          await sleep(700)
        }

        const flipResult = flipCoin()
        const win = side === flipResult
        const flipMultiplier = win
          ? guildConfig.casinoSettings.coinflip.winMultiplier
          : 0
        const winnings = win ? unitBet * flipMultiplier : 0

        if (
          shouldAnnounceByMultiplier(
            flipMultiplier,
            guildConfig.casinoSettings.winAnnouncements.coinflipMinMultiplier
          )
        ) {
          announcementFlips.push(
            formatBigWinLine({
              label: `Flip **${i + 1}**`,
              middle: [coinEmojis[flipResult]],
              multiplier: flipMultiplier.toFixed(2),
              payout: formatMoney(winnings, guildConfig.globalSettings),
              bet: formatMoney(unitBet, guildConfig.globalSettings)
            })
          )
        }

        results.push(
          `${coinEmojis[flipResult]} | ${win ? '🎉' : '❌'} | ${
            win
              ? `**+${formatMoney(winnings, guildConfig.globalSettings)}**`
              : `**-${formatMoney(unitBet, guildConfig.globalSettings)}**`
          }`
        )

        totalWinnings += winnings
        liveResult += winnings - unitBet
      }

      const isWin = liveResult > 0
      const isLoss = liveResult < 0

      return {
        totalWinnings,
        announce: {
          game: 'coin-flip',
          lines: announcementFlips,
          sourceChannelId: interaction.channelId
        },
        buildFinalEmbed: (finalBalance) =>
          createBetEmbed(
            isWin
              ? '🪙 **Win!** 🎉'
              : isLoss
                ? '🪙 **Better Luck Next Time...** ❌'
                : '🪙 **Not Bad...** 👀',
            isWin ? 'Green' : isLoss ? 'Red' : 'Yellow',
            `💵 Total Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**\n\n` +
              `🪙 **Flip Results:**\n${results.join('\n')}\n\n` +
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
