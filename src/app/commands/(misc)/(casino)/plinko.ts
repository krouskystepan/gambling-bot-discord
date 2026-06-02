import {
  PLINKO_ROW_COUNT,
  formatNumberToReadableString,
  generateId,
  getPlinkoMultiplierAtPathIndex,
  normalizePlinkoBinMultipliers,
  parseReadableStringToNumber
} from 'gambling-bot-shared'

import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  checkCasinoChannels,
  checkUserRegistration,
  getUser,
  reserveCasinoBet,
  settleCasinoWinnings
} from '@/services'
import { renderBoardFrame } from '@/utils/casino/plinko'
import { dropPlinkoPath } from '@/utils/casino/rng'
import { isUserOnCooldown } from '@/utils/common/userCooldown'
import { checkValidBet } from '@/utils/common/utils'
import { createBetEmbed, createErrorEmbed } from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'plinko',
  description: 'Drop balls down the Plinko board!',
  options: [
    {
      name: 'bet',
      description: 'Bet per ball (e.g., 1000, 2k, 4.5k).',
      type: ApplicationCommandOptionType.String,
      required: true
    },
    {
      name: 'balls',
      description: 'How many balls to drop.',
      type: ApplicationCommandOptionType.Integer,
      required: false,
      choices: Array.from({ length: 10 }, (_, i) => ({
        name: (i + 1).toString(),
        value: i + 1
      }))
    },
    {
      name: 'show-balance',
      description: 'Displays the current balance (VISIBLE TO EVERYONE).',
      type: ApplicationCommandOptionType.Boolean,
      required: false
    },
    {
      name: 'skip-animations',
      description: 'Skip animations for faster results.',
      type: ApplicationCommandOptionType.Boolean,
      required: false
    }
  ],
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
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

    const balls = interaction.options.getInteger('balls') || 1
    const betInput = interaction.options.getString('bet', true)
    const betAmount = parseReadableStringToNumber(betInput)
    const showBalance = interaction.options.getBoolean('show-balance')
    const skipAnimations = interaction.options.getBoolean('skip-animations')

    const isBetValid = checkValidBet(
      interaction,
      betAmount,
      configReply.casinoSettings.plinko.maxBet,
      configReply.casinoSettings.plinko.minBet
    )
    if (!isBetValid) return

    totalBet = betAmount * balls
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

    const binMultipliers = normalizePlinkoBinMultipliers(
      configReply.casinoSettings.plinko.binMultipliers
    )

    const rows = PLINKO_ROW_COUNT

    let totalWinnings = 0
    let liveResult = 0
    const results: string[] = []

    await interaction.deferReply()

    const paths: number[][] = []
    for (let i = 0; i < balls; i++) {
      paths.push(dropPlinkoPath(rows))
    }

    const SPAWN_DELAY_STEPS = 2 // X ticks between balls
    const pathLength = rows + 1
    const totalTimelineSteps = pathLength + SPAWN_DELAY_STEPS * (balls - 1)

    if (!skipAnimations) {
      for (let globalStep = 0; globalStep < totalTimelineSteps; globalStep++) {
        await interaction.editReply({
          embeds: [
            createBetEmbed(
              `🎯 Balls dropping...`,
              'Blue',
              `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
                renderBoardFrame(
                  rows,
                  paths,
                  globalStep,
                  SPAWN_DELAY_STEPS,
                  binMultipliers
                ) +
                `\n\n💰 Total: ${
                  liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                } **$${formatNumberToReadableString(liveResult)}**`,
              betId
            )
          ]
        })

        await new Promise((res) => setTimeout(res, 350))
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
      const winnings = betAmount * multiplier
      const netForBall = winnings - betAmount

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

      const isNegative = displayValue < 0
      const formattedAmount = formatNumberToReadableString(
        Math.abs(displayValue)
      )

      results.push(
        `Ball **${i + 1}** - x${formattedMultiplier} | ${emoji} | ${
          isNegative ? '-' : ''
        }$${formattedAmount}`
      )
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
            ? '🎯 **Win!** 🎉'
            : isLoss
              ? '🎯 **Better Luck Next Time...** ❌'
              : '🎯 **Not Bad...** 👀',
          isWin ? 'Green' : isLoss ? 'Red' : 'Yellow',
          `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
            `🎯 **Ball Results:**\n${results.join('\n')}\n\n` +
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
