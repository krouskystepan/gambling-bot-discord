import {
  TCasinoSettings,
  shouldAnnounceByMultiplier
} from 'gambling-bot-shared/casino'
import {
  formatMoney,
  parseReadableStringToNumber
} from 'gambling-bot-shared/common'

import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import {
  betOption,
  roundCountOption,
  runInstantCasinoCommand,
  showBalanceOption,
  skipAnimationsOption
} from '@/services'
import { drawLottery } from '@/utils/casino/rng'
import { sleep } from '@/utils/common/utils'
import { createBetEmbed, createErrorEmbed } from '@/utils/discord/createEmbed'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'

export const command: CommandData = {
  name: 'lottery',
  description: 'Play the lottery! Pick 4 numbers and see if you win.',
  options: [
    betOption,
    {
      name: 'numbers',
      description:
        'Pick 4 numbers between 1-50, separated by commas (e.g., 3, 14, 25, 38).',
      type: ApplicationCommandOptionType.String,
      required: true
    },
    roundCountOption('entries', 10, 'Number of entries.'),
    showBalanceOption,
    skipAnimationsOption
  ],
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  await runInstantCasinoCommand<{
    unitBet: number
    entries: number
    userNumbers: number[]
  }>({
    interaction,
    game: 'lottery',
    prepareInput: async ({ interaction, guildConfig }) => {
      const entries = interaction.options.getInteger('entries') || 1
      const betAmount = interaction.options.getString('bet', true)
      const unitBet = parseReadableStringToNumber(betAmount)

      const numbersInput = interaction.options.getString('numbers', true)
      const userNumbers = numbersInput
        .split(',')
        .map((n) => parseFloat(n.trim()))

      if (
        userNumbers.length !== 4 ||
        userNumbers.some(
          (n) =>
            !Number.isInteger(n) ||
            n < 1 ||
            n > 50 ||
            new Set(userNumbers).size !== 4
        )
      ) {
        await interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid Input - Invalid Numbers',
              'Pick 5 unique whole numbers between 1-50, separated by commas (e.g., 3, 14, 25, 38).'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
        return { ok: false }
      }

      return {
        ok: true,
        totalBet: unitBet * entries,
        validateBetAmount: unitBet,
        minBet: guildConfig.casinoSettings.lottery.minBet,
        maxBet: guildConfig.casinoSettings.lottery.maxBet,
        input: { unitBet, entries, userNumbers }
      }
    },
    executeGame: async ({
      interaction,
      guildConfig,
      betId,
      totalBet,
      showBalance,
      skipAnimations,
      input: { unitBet, entries, userNumbers }
    }) => {
      let totalWinnings = 0
      let liveResult = 0
      const results: string[] = []
      const announcementDraws: string[] = []

      for (let i = 0; i < entries; i++) {
        if (!skipAnimations) {
          await interaction.editReply({
            embeds: [
              createBetEmbed(
                `🎟️ Drawing...`,
                'Blue',
                `💵 Total Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**\n\n` +
                  `Your numbers: **${userNumbers
                    .map((n) => n.toString().padStart(2, '0'))
                    .join(', ')}**\n\n` +
                  `🎟️ **Draw Results:**\n${[...results, '🎟️ Drawing...'].join('\n')}\n\n` +
                  `💰 Total: ${
                    liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                  } **${formatMoney(liveResult, guildConfig.globalSettings)}**`,
                betId
              )
            ]
          })

          await sleep(700)
        }

        const lotteryNumbers = drawLottery()
        const resultString = lotteryNumbers
          .map((n) => n.toString().padStart(2, '0'))
          .join(', ')

        const matchedNumbers = userNumbers.filter((n) =>
          lotteryNumbers.includes(n)
        ).length as keyof TCasinoSettings['lottery']['winMultipliers']

        const drawMultiplier =
          guildConfig.casinoSettings.lottery.winMultipliers[matchedNumbers]
        const winnings = unitBet * drawMultiplier

        if (
          shouldAnnounceByMultiplier(
            drawMultiplier,
            guildConfig.casinoSettings.winAnnouncements.lotteryMinMultiplier
          )
        ) {
          announcementDraws.push(
            formatBigWinLine({
              label: `Draw **${i + 1}**`,
              middle: [`**${matchedNumbers} matches**`],
              multiplier: String(drawMultiplier),
              payout: formatMoney(winnings, guildConfig.globalSettings),
              bet: formatMoney(unitBet, guildConfig.globalSettings)
            })
          )
        }

        results.push(
          `**${resultString}** | ${matchedNumbers > 0 ? `🎉 **${matchedNumbers}**` : `❌ **0**`} | ${
            winnings > unitBet
              ? `**+${formatMoney(winnings, guildConfig.globalSettings)}**`
              : winnings < unitBet
                ? `**-${formatMoney(unitBet, guildConfig.globalSettings)}**`
                : `**${formatMoney(0, guildConfig.globalSettings)}**`
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
          game: 'lottery',
          lines: announcementDraws,
          sourceChannelId: interaction.channelId
        },
        buildFinalEmbed: (finalBalance) =>
          createBetEmbed(
            isWin
              ? '🎟️ **Win!** 🎉'
              : isLoss
                ? '🎟️ **Better Luck Next Time...** ❌'
                : '🎟️ **Not Bad...** 👀',
            isWin ? 'Green' : isLoss ? 'Red' : 'Yellow',
            `💵 Total Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**\n\n` +
              `Your numbers: **${userNumbers
                .map((n) => n.toString().padStart(2, '0'))
                .join(', ')}**\n\n` +
              `🎟️ **Draw Results:**\n${results.join('\n')}\n\n` +
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
