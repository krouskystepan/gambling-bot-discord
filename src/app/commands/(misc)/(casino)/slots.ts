import { shouldAnnounceByMultiplier } from 'gambling-bot-shared/casino'
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
import { spinSlot } from '@/utils/casino/rng'
import { sleep } from '@/utils/common/utils'
import { createBetEmbed } from '@/utils/discord/createEmbed'
import { slotEmojis, spinSlotEmotes } from '@/utils/discord/customEmotes'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'

export const command: CommandData = {
  name: 'slots',
  description: 'Spin the slot machine!',
  options: [
    betOption,
    roundCountOption('spins', 10, 'Number of spins.'),
    showBalanceOption,
    skipAnimationsOption
  ],
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  await runInstantCasinoCommand<{ unitBet: number; spins: number }>({
    interaction,
    game: 'slots',
    prepareInput: async ({ interaction, guildConfig }) => {
      const spins = interaction.options.getInteger('spins') || 1
      const betAmount = interaction.options.getString('bet', true)
      const unitBet = parseReadableStringToNumber(betAmount)

      return {
        ok: true,
        totalBet: unitBet * spins,
        validateBetAmount: unitBet,
        minBet: guildConfig.casinoSettings.slots.minBet,
        maxBet: guildConfig.casinoSettings.slots.maxBet,
        input: { unitBet, spins }
      }
    },
    executeGame: async ({
      interaction,
      guildConfig,
      betId,
      totalBet,
      showBalance,
      skipAnimations,
      input: { unitBet, spins }
    }) => {
      let totalWinnings = 0
      let liveResult = 0
      const results: string[] = []
      const announcementSpins: string[] = []

      for (let i = 0; i < spins; i++) {
        if (!skipAnimations) {
          await interaction.editReply({
            embeds: [
              createBetEmbed(
                `🎰 Spinning...`,
                'Blue',
                `💵 Total Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**\n\n` +
                  `🕹 Spin Results:\n${results.join('\n')}${
                    results.length ? '\n' : ''
                  }${spinSlotEmotes[1]}${spinSlotEmotes[2]}${spinSlotEmotes[3]}` +
                  `\n\n💰 Total: ${
                    liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                  } **${formatMoney(liveResult, guildConfig.globalSettings)}**`,
                betId
              )
            ]
          })

          await sleep(700)
        }

        const spinResult = spinSlot({
          symbolWeights: guildConfig.casinoSettings.slots.symbolWeights
        })

        const resultString = spinResult.replace(
          /🍒|🫐|🍉|🔔|7️⃣/g,
          (match) => slotEmojis[match]
        )

        const spinMultiplier =
          guildConfig.casinoSettings.slots.winMultipliers[spinResult] || 0
        const winnings = spinMultiplier * unitBet
        const isWin = winnings > 0

        if (
          shouldAnnounceByMultiplier(
            spinMultiplier,
            guildConfig.casinoSettings.winAnnouncements.slotsMinMultiplier
          )
        ) {
          announcementSpins.push(
            formatBigWinLine({
              label: `Spin **${i + 1}**`,
              middle: [`**${resultString}**`],
              multiplier: String(spinMultiplier),
              payout: formatMoney(winnings, guildConfig.globalSettings),
              bet: formatMoney(unitBet, guildConfig.globalSettings)
            })
          )
        }

        results.push(
          `**${resultString}** | ${isWin ? '🎉' : '❌'} | ${
            isWin
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
          game: 'slots',
          lines: announcementSpins,
          sourceChannelId: interaction.channelId
        },
        buildFinalEmbed: (finalBalance) =>
          createBetEmbed(
            isWin
              ? '🎰 **Win!** 🎉'
              : isLoss
                ? '🎰 **Better Luck Next Time...** ❌'
                : '🎰 **Not Bad...** 👀',
            isWin ? 'Green' : isLoss ? 'Red' : 'Yellow',
            `💵 Total Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**\n\n` +
              `🕹 **Spin Results:**\n${results.join('\n')}\n\n` +
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
