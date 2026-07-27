import {
  LIMBO_MAX_TARGET,
  LIMBO_MIN_TARGET,
  isLimboWin,
  isValidLimboTarget,
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
import { rollLimbo } from '@/utils/casino/rng'
import { sleep } from '@/utils/common/utils'
import { createBetEmbed, createErrorEmbed } from '@/utils/discord/createEmbed'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'

const formatTarget = (value: number) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

export const command: CommandData = {
  name: 'limbo',
  description: 'Aim for a target multiplier!',
  options: [
    betOption,
    {
      name: 'target',
      description: `Target multiplier (${LIMBO_MIN_TARGET}–${LIMBO_MAX_TARGET}).`,
      type: ApplicationCommandOptionType.Number,
      required: true,
      min_value: LIMBO_MIN_TARGET,
      max_value: LIMBO_MAX_TARGET
    },
    roundCountOption('rolls', 10, 'Number of rolls.'),
    showBalanceOption,
    skipAnimationsOption
  ],
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  await runInstantCasinoCommand<{
    target: number
    unitBet: number
    rolls: number
  }>({
    interaction,
    game: 'limbo',
    prepareInput: async ({ interaction, guildConfig }) => {
      const rolls = interaction.options.getInteger('rolls') || 1
      const target = interaction.options.getNumber('target', true)
      const betAmount = interaction.options.getString('bet', true)
      const unitBet = parseReadableStringToNumber(betAmount)

      if (!isValidLimboTarget(target)) {
        await interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid Input - Invalid Target',
              `Pick a target between **${LIMBO_MIN_TARGET}** and **${LIMBO_MAX_TARGET.toLocaleString('en-US')}**.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
        return { ok: false }
      }

      return {
        ok: true,
        totalBet: unitBet * rolls,
        validateBetAmount: unitBet,
        minBet: guildConfig.casinoSettings.limbo.minBet,
        maxBet: guildConfig.casinoSettings.limbo.maxBet,
        input: { target, unitBet, rolls }
      }
    },
    executeGame: async ({
      interaction,
      guildConfig,
      betId,
      totalBet,
      showBalance,
      skipAnimations,
      input: { target, unitBet, rolls }
    }) => {
      let totalWinnings = 0
      let liveResult = 0
      const results: string[] = []
      const announcementRolls: string[] = []
      const houseEdge = guildConfig.casinoSettings.limbo.houseEdge
      const targetLabel = formatTarget(target)

      for (let i = 0; i < rolls; i++) {
        if (!skipAnimations) {
          await interaction.editReply({
            embeds: [
              createBetEmbed(
                `🚀 Climbing...`,
                'Blue',
                `💵 Total Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**\n` +
                  `🎯 Target: **x${targetLabel}**\n\n` +
                  `🚀 **Roll Results:**\n${[...results, '⏳ ...'].join('\n')}` +
                  `\n\n💰 Total: ${
                    liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                  } **${formatMoney(liveResult, guildConfig.globalSettings)}**`,
                betId
              )
            ]
          })

          await sleep(700)
        }

        const result = rollLimbo(houseEdge)
        const win = isLimboWin(result, target)
        const winnings = win ? unitBet * target : 0
        const resultLabel = formatTarget(result)

        if (
          win &&
          shouldAnnounceByMultiplier(
            target,
            guildConfig.casinoSettings.winAnnouncements.limboMinMultiplier
          )
        ) {
          announcementRolls.push(
            formatBigWinLine({
              label: `Roll **${i + 1}**`,
              middle: [`hit **x${resultLabel}**`],
              multiplier: targetLabel,
              payout: formatMoney(winnings, guildConfig.globalSettings),
              bet: formatMoney(unitBet, guildConfig.globalSettings)
            })
          )
        }

        results.push(
          `🎯 x${targetLabel} → **x${resultLabel}** | ${win ? '🎉' : '❌'} | ${
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
          game: 'limbo',
          lines: announcementRolls,
          sourceChannelId: interaction.channelId
        },
        buildFinalEmbed: (finalBalance) =>
          createBetEmbed(
            isWin
              ? '🚀 **Win!** 🎉'
              : isLoss
                ? '🚀 **Better Luck Next Time...** ❌'
                : '🚀 **Not Bad...** 👀',
            isWin ? 'Green' : isLoss ? 'Red' : 'Yellow',
            `💵 Total Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**\n` +
              `🎯 Target: **x${targetLabel}**\n\n` +
              `🚀 **Roll Results:**\n${results.join('\n')}\n\n` +
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
