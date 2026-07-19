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
import { rollDice } from '@/utils/casino/rng'
import { sleep } from '@/utils/common/utils'
import { createBetEmbed } from '@/utils/discord/createEmbed'
import { diceEmojis, rollDiceEmote } from '@/utils/discord/customEmotes'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'

export const command: CommandData = {
  name: 'dice',
  description: 'Play a dice game!',
  options: [
    betOption,
    {
      name: 'side',
      description: 'Choose a dice side.',
      type: ApplicationCommandOptionType.Integer,
      required: true,
      choices: Array.from({ length: 6 }, (_, i) => ({
        name: (i + 1).toString(),
        value: i + 1
      }))
    },
    roundCountOption('rolls', 10, 'Number of rolls.'),
    showBalanceOption,
    skipAnimationsOption
  ],
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  await runInstantCasinoCommand<{
    side: number
    unitBet: number
    rolls: number
  }>({
    interaction,
    game: 'dice',
    prepareInput: async ({ interaction, guildConfig }) => {
      const rolls = interaction.options.getInteger('rolls') || 1
      const side = interaction.options.getInteger('side', true)
      const betAmount = interaction.options.getString('bet', true)
      const unitBet = parseReadableStringToNumber(betAmount)

      return {
        ok: true,
        totalBet: unitBet * rolls,
        validateBetAmount: unitBet,
        minBet: guildConfig.casinoSettings.dice.minBet,
        maxBet: guildConfig.casinoSettings.dice.maxBet,
        input: { side, unitBet, rolls }
      }
    },
    executeGame: async ({
      interaction,
      guildConfig,
      betId,
      totalBet,
      showBalance,
      skipAnimations,
      input: { side, unitBet, rolls }
    }) => {
      let totalWinnings = 0
      let liveResult = 0
      const results: string[] = []
      const announcementRolls: string[] = []

      for (let i = 0; i < rolls; i++) {
        if (!skipAnimations) {
          await interaction.editReply({
            embeds: [
              createBetEmbed(
                `🎲 Rolling...`,
                'Blue',
                `💵 Total Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**\n\n` +
                  `🎲 **Roll Results:**\n${[...results, rollDiceEmote].join('\n')}` +
                  `\n\n💰 Total: ${
                    liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                  } **${formatMoney(liveResult, guildConfig.globalSettings)}**`,
                betId
              )
            ]
          })

          await sleep(700)
        }

        const dice = rollDice()
        const win = side === dice
        const rollMultiplier = win
          ? guildConfig.casinoSettings.dice.winMultiplier
          : 0
        const winnings = win ? unitBet * rollMultiplier : 0

        const diceEmoji = diceEmojis[dice] ?? '🎲'

        if (
          shouldAnnounceByMultiplier(
            rollMultiplier,
            guildConfig.casinoSettings.winAnnouncements.diceMinMultiplier
          )
        ) {
          announcementRolls.push(
            formatBigWinLine({
              label: `Roll **${i + 1}**`,
              middle: [diceEmoji],
              multiplier: String(rollMultiplier),
              payout: formatMoney(winnings, guildConfig.globalSettings),
              bet: formatMoney(unitBet, guildConfig.globalSettings)
            })
          )
        }

        results.push(
          `${diceEmoji} | ${win ? '🎉' : '❌'} | ${
            win
              ? `+${formatMoney(winnings, guildConfig.globalSettings)}`
              : `-${formatMoney(unitBet, guildConfig.globalSettings)}`
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
          game: 'dice',
          lines: announcementRolls,
          sourceChannelId: interaction.channelId
        },
        buildFinalEmbed: (finalBalance) =>
          createBetEmbed(
            isWin
              ? '🎲 **Win!** 🎉'
              : isLoss
                ? '🎲 **Better Luck Next Time...** ❌'
                : '🎲 **Not Bad...** 👀',
            isWin ? 'Green' : isLoss ? 'Red' : 'Yellow',
            `💵 Total Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**\n\n` +
              `🎲 **Roll Results:**\n${results.join('\n')}\n\n` +
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
