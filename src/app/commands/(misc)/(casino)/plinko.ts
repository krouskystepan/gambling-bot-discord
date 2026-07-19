import {
  PLINKO_ROW_COUNT,
  getPlinkoMultiplierAtPathIndex,
  normalizePlinkoBinMultipliers,
  shouldAnnouncePlinkoBall
} from 'gambling-bot-shared/casino'
import {
  formatMoney,
  parseReadableStringToNumber
} from 'gambling-bot-shared/common'

import { ChatInputCommand, CommandData } from 'commandkit'

import {
  betOption,
  roundCountOption,
  runInstantCasinoCommand,
  showBalanceOption,
  skipAnimationsOption
} from '@/services'
import { renderBoardFrame } from '@/utils/casino/plinko'
import { dropPlinkoPath } from '@/utils/casino/rng'
import { sleep } from '@/utils/common/utils'
import { createBetEmbed } from '@/utils/discord/createEmbed'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'

export const command: CommandData = {
  name: 'plinko',
  description: 'Drop balls down the Plinko board!',
  options: [
    betOption,
    roundCountOption('balls', 10, 'How many balls to drop.'),
    showBalanceOption,
    skipAnimationsOption
  ],
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  await runInstantCasinoCommand<{ unitBet: number; balls: number }>({
    interaction,
    game: 'plinko',
    prepareInput: async ({ interaction, guildConfig }) => {
      const balls = interaction.options.getInteger('balls') || 1
      const betInput = interaction.options.getString('bet', true)
      const unitBet = parseReadableStringToNumber(betInput)

      return {
        ok: true,
        totalBet: unitBet * balls,
        validateBetAmount: unitBet,
        minBet: guildConfig.casinoSettings.plinko.minBet,
        maxBet: guildConfig.casinoSettings.plinko.maxBet,
        input: { unitBet, balls }
      }
    },
    executeGame: async ({
      interaction,
      guildConfig,
      betId,
      totalBet,
      showBalance,
      skipAnimations,
      input: { unitBet, balls }
    }) => {
      const binMultipliers = normalizePlinkoBinMultipliers(
        guildConfig.casinoSettings.plinko.binMultipliers
      )
      const rows = PLINKO_ROW_COUNT

      let totalWinnings = 0
      let liveResult = 0
      const results: string[] = []
      const announcementBalls: string[] = []

      const paths: number[][] = []
      for (let i = 0; i < balls; i++) {
        paths.push(dropPlinkoPath(rows))
      }

      const SPAWN_DELAY_STEPS = 2
      const pathLength = rows + 1
      const totalTimelineSteps = pathLength + SPAWN_DELAY_STEPS * (balls - 1)

      if (!skipAnimations) {
        for (
          let globalStep = 0;
          globalStep < totalTimelineSteps;
          globalStep++
        ) {
          await interaction.editReply({
            embeds: [
              createBetEmbed(
                `🎯 Balls dropping...`,
                'Blue',
                `💵 Total Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**\n\n` +
                  renderBoardFrame(
                    rows,
                    paths,
                    globalStep,
                    SPAWN_DELAY_STEPS,
                    binMultipliers
                  ) +
                  `\n\n💰 Total: ${
                    liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                  } **${formatMoney(liveResult, guildConfig.globalSettings)}**`,
                betId
              )
            ]
          })

          await sleep(350)
        }
      }

      for (let i = 0; i < balls; i++) {
        const path = paths[i]
        const finalBin = path[path.length - 1]
        const multiplier = getPlinkoMultiplierAtPathIndex(
          binMultipliers,
          finalBin
        )
        const formattedMultiplier = Number(multiplier).toFixed(2)
        const winnings = unitBet * multiplier
        const netForBall = winnings - unitBet

        totalWinnings += winnings
        liveResult += netForBall

        let displayValue: number
        let emoji: string

        if (multiplier > 1) {
          displayValue = winnings
          emoji = '🎉'
        } else if (multiplier < 1) {
          displayValue = netForBall
          emoji = '❌'
        } else {
          displayValue = 0
          emoji = '➖'
        }

        results.push(
          `Ball **${i + 1}** - x${formattedMultiplier} | ${emoji} | ${formatMoney(displayValue, guildConfig.globalSettings)}`
        )

        if (
          shouldAnnouncePlinkoBall(
            multiplier,
            guildConfig.casinoSettings.winAnnouncements.plinkoMinMultiplier
          )
        ) {
          announcementBalls.push(
            formatBigWinLine({
              label: `Ball **${i + 1}**`,
              multiplier: formattedMultiplier,
              payout: formatMoney(winnings, guildConfig.globalSettings)
            })
          )
        }
      }

      const isWin = liveResult > 0
      const isLoss = liveResult < 0

      return {
        totalWinnings,
        announce: {
          game: 'plinko',
          lines: announcementBalls
        },
        buildFinalEmbed: (finalBalance) =>
          createBetEmbed(
            isWin
              ? '🎯 **Win!** 🎉'
              : isLoss
                ? '🎯 **Better Luck Next Time...** ❌'
                : '🎯 **Not Bad...** 👀',
            isWin ? 'Green' : isLoss ? 'Red' : 'Yellow',
            `💵 Total Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**\n\n` +
              `🎯 **Ball Results:**\n${results.join('\n')}\n\n` +
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
