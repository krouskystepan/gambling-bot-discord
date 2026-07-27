import { shouldAnnounceGoldenJackpotHit } from 'gambling-bot-shared/casino'
import {
  formatMoney,
  parseReadableStringToNumber
} from 'gambling-bot-shared/common'

import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import {
  betOption,
  runInstantCasinoCommand,
  showBalanceOption,
  skipAnimationsOption
} from '@/services'
import { drawGoldenJackpot } from '@/utils/casino/rng'
import { sleep } from '@/utils/common/utils'
import { createBetEmbed, createErrorEmbed } from '@/utils/discord/createEmbed'

const GOLDEN_JACKPOT_MAX_ENTRIES = 100

export const command: CommandData = {
  name: 'goldenjackpot',
  description: `Try your luck at the Golden Jackpot HUGEx!`,
  options: [
    betOption,
    {
      name: 'entries',
      description: `Number of entries (max is ${GOLDEN_JACKPOT_MAX_ENTRIES}).`,
      type: ApplicationCommandOptionType.Integer,
      required: false
    },
    showBalanceOption,
    skipAnimationsOption
  ],
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  await runInstantCasinoCommand<{ unitBet: number; entries: number }>({
    interaction,
    game: 'goldenJackpot',
    prepareInput: async ({ interaction, guildConfig }) => {
      const entries = interaction.options.getInteger('entries') || 1
      const betAmount = interaction.options.getString('bet', true)
      const unitBet = parseReadableStringToNumber(betAmount)

      if (entries > GOLDEN_JACKPOT_MAX_ENTRIES || entries < 1) {
        await interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid Input - Entries',
              `The number of entries must be between 1 and ${GOLDEN_JACKPOT_MAX_ENTRIES}.`
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
        minBet: guildConfig.casinoSettings.goldenJackpot.minBet,
        maxBet: guildConfig.casinoSettings.goldenJackpot.maxBet,
        input: { unitBet, entries }
      }
    },
    executeGame: async ({
      interaction,
      guildConfig,
      betId,
      totalBet,
      showBalance,
      skipAnimations,
      input: { unitBet, entries }
    }) => {
      const initialTickets = entries
      let totalWinnings = 0
      let liveResult = 0
      let jackpotTries: string[] = []
      const announcementHits: string[] = []

      if (!skipAnimations) {
        await interaction.editReply({
          embeds: [
            createBetEmbed(
              `🤑 Drawing...`,
              'Blue',
              `💵 Total Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**\n\n` +
                `🎟️ Tickets left: **${initialTickets}**\n` +
                `\n💰 Total: ${
                  liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                } **${formatMoney(liveResult, guildConfig.globalSettings)}**`,
              betId
            )
          ]
        })

        await sleep(1000)
      }

      let step = 1
      if (entries > 50) step = 10
      else if (entries > 20) step = 5
      else if (entries > 10) step = 2

      for (let i = 0; i < entries; i++) {
        const tryNumber = i + 1
        const jackpotNumber = drawGoldenJackpot(
          guildConfig.casinoSettings.goldenJackpot
        )
        const isJackpot = jackpotNumber === 1
        const winnings = isJackpot
          ? unitBet * guildConfig.casinoSettings.goldenJackpot.winMultiplier
          : 0

        totalWinnings += winnings
        liveResult += winnings - unitBet

        if (isJackpot) {
          const tryLabel = tryNumber.toString().padStart(3, '0')

          jackpotTries.push(
            `**JACKPOT!** You won **${formatMoney(
              winnings,
              guildConfig.globalSettings
            )}** on Try **#${tryLabel}**! 🔥`
          )

          if (
            shouldAnnounceGoldenJackpotHit(
              guildConfig.casinoSettings.goldenJackpot.winMultiplier,
              guildConfig.casinoSettings.winAnnouncements
                .goldenJackpotMinMultiplier
            )
          ) {
            announcementHits.push(
              `hit the jackpot on Try **#${tryLabel}**!\n💰 Won: **${formatMoney(winnings, guildConfig.globalSettings)}** (bet **${formatMoney(unitBet, guildConfig.globalSettings)}**)`
            )
          }
        }

        if (!skipAnimations) {
          let ticketsLeft = Math.max(1, initialTickets - tryNumber)
          if (initialTickets > 10) {
            ticketsLeft = Math.max(step, Math.ceil(ticketsLeft / step) * step)
          }

          if (
            !skipAnimations &&
            tryNumber < entries &&
            tryNumber % step === 0
          ) {
            await interaction.editReply({
              embeds: [
                createBetEmbed(
                  `🤑 Drawing...`,
                  'Blue',
                  `💵 Total Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**\n\n` +
                    `🎟️ Tickets left: **${ticketsLeft}**\n` +
                    (jackpotTries.length > 0
                      ? `\n**🤑 JACKPOT WINS:**\n${jackpotTries.join('\n')}\n`
                      : '') +
                    `\n💰 Total: ${
                      liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                    } **${formatMoney(liveResult, guildConfig.globalSettings)}**`,
                  betId
                )
              ]
            })
            await sleep(1000)
          }
        }
      }

      const isWin = liveResult > 0
      const isLoss = liveResult < 0

      return {
        totalWinnings,
        announce: {
          game: 'goldenjackpot',
          lines: announcementHits,
          sourceChannelId: interaction.channelId
        },
        buildFinalEmbed: (finalBalance) =>
          createBetEmbed(
            isWin
              ? '🤑 **JACKPOT!** 🎉'
              : isLoss
                ? '🤑 **Better Luck Next Time...** ❌'
                : '🤑 **Not Bad...** 👀',
            isWin ? 'Green' : isLoss ? 'Red' : 'Yellow',
            `💵 Total Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**\n\n` +
              `🤑 **Draw Result:**${isWin ? `\n ${jackpotTries.join('\n')}` : ' No win'}\n\n` +
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
