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
import { drawGoldenJackpot } from '@/utils/casino/rng'
import { isUserOnCooldown } from '@/utils/common/userCooldown'
import {
  checkValidBet,
  formatNumberToReadableString,
  generateId,
  parseReadableStringToNumber
} from '@/utils/common/utils'
import { createBetEmbed, createErrorEmbed } from '@/utils/discord/createEmbed'

const GOLDEN_JACKPOT_MAX_ENTRIES = 100

export const data: CommandData = {
  name: 'goldenjackpot',
  description: `Try your luck at the Golden Jackpot HUGEx!`,
  options: [
    {
      name: 'bet',
      description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
      type: ApplicationCommandOptionType.String,
      required: true
    },
    {
      name: 'entries',
      description: `Number of entries (max is ${GOLDEN_JACKPOT_MAX_ENTRIES}).`,
      type: ApplicationCommandOptionType.Integer,
      required: false
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

    const entries = interaction.options.getInteger('entries') || 1
    const betAmount = interaction.options.getString('bet', true)
    const parsedBetAmount = parseReadableStringToNumber(betAmount)
    const showBalance = interaction.options.getBoolean('show-balance')
    const skipAnimations = interaction.options.getBoolean('skip-animations')

    if (entries > GOLDEN_JACKPOT_MAX_ENTRIES || entries < 1) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Invalid Input - Entries',
            `The number of entries must be between 1 and ${GOLDEN_JACKPOT_MAX_ENTRIES}.`
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const isBetValid = checkValidBet(
      interaction,
      parsedBetAmount,
      configReply.casinoSettings.goldenJackpot.maxBet,
      configReply.casinoSettings.goldenJackpot.minBet
    )

    if (!isBetValid) return

    totalBet = parsedBetAmount * entries
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

    const initialTickets = entries
    let liveResult = 0
    let jackpotTries: string[] = []

    await interaction.deferReply()

    if (!skipAnimations) {
      await interaction.editReply({
        embeds: [
          createBetEmbed(
            `🤑 Drawing...`,
            'Blue',
            `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
              `🎟️ Tickets left: **${initialTickets}**\n` +
              `\n💰 Total: ${
                liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
              } **$${formatNumberToReadableString(liveResult)}**`,
            betId
          )
        ]
      })

      await new Promise((res) => setTimeout(res, 1000))
    }

    let step = 1
    if (entries > 50) step = 10
    else if (entries > 20) step = 5
    else if (entries > 10) step = 2

    for (let i = 0; i < entries; i++) {
      const tryNumber = i + 1
      const jackpotNumber = drawGoldenJackpot(
        configReply.casinoSettings.goldenJackpot
      )
      const isJackpot = jackpotNumber === 1
      const winnings = isJackpot
        ? parsedBetAmount *
          configReply.casinoSettings.goldenJackpot.winMultiplier
        : 0

      totalWinnings += winnings
      liveResult += winnings - parsedBetAmount

      if (isJackpot) {
        jackpotTries.push(
          `**JACKPOT!** You won **$${formatNumberToReadableString(
            winnings
          )}** on Try **#${tryNumber.toString().padStart(3, '0')}**! 🔥`
        )
      }

      if (!skipAnimations) {
        let ticketsLeft = Math.max(1, initialTickets - tryNumber)
        if (initialTickets > 10) {
          ticketsLeft = Math.max(step, Math.ceil(ticketsLeft / step) * step)
        }

        if (!skipAnimations && tryNumber < entries && tryNumber % step === 0) {
          await interaction.editReply({
            embeds: [
              createBetEmbed(
                `🤑 Drawing...`,
                'Blue',
                `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
                  `🎟️ Tickets left: **${ticketsLeft}**\n` +
                  (jackpotTries.length > 0
                    ? `\n**🤑 JACKPOT WINS:**\n${jackpotTries.join('\n')}\n`
                    : '') +
                  `\n💰 Total: ${
                    liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                  } **$${formatNumberToReadableString(liveResult)}**`,
                betId
              )
            ]
          })
          await new Promise((res) => setTimeout(res, 1000))
        }
      }
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
            ? '🤑 **JACKPOT!** 🎉'
            : isLoss
              ? '🤑 **Better Luck Next Time...** ❌'
              : '🤑 **Not Bad...** 👀',
          isWin ? 'Green' : isLoss ? 'Red' : 'Yellow',
          `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
            `🤑 **Draw Result:**${isWin ? `\n ${jackpotTries.join('\n')}` : ' No win'}\n\n` +
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
