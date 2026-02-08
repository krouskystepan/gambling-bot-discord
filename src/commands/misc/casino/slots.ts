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
import { spinSlot } from '@/utils/casino/rng'
import { isUserOnCooldown } from '@/utils/common/userCooldown'
import {
  checkValidBet,
  formatNumberToReadableString,
  generateId,
  parseReadableStringToNumber
} from '@/utils/common/utils'
import { createBetEmbed, createErrorEmbed } from '@/utils/discord/createEmbed'
import { slotEmojis, spinSlotEmotes } from '@/utils/discord/customEmotes'

export const data: CommandData = {
  name: 'slots',
  description: 'Spin the slot machine!',
  options: [
    {
      name: 'bet',
      description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
      type: ApplicationCommandOptionType.String,
      required: true
    },
    {
      name: 'spins',
      description: 'Number of spins.',
      type: ApplicationCommandOptionType.Integer,
      required: false,
      choices: Array.from({ length: 10 }, (_, i) => ({
        name: (i + 1).toString(),
        value: i + 1
      }))
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

    const spins = interaction.options.getInteger('spins') || 1
    const betAmount = interaction.options.getString('bet', true)
    const parsedBetAmount = parseReadableStringToNumber(betAmount)
    const readableBetAmount = formatNumberToReadableString(parsedBetAmount)
    const showBalance = interaction.options.getBoolean('show-balance')
    const skipAnimations = interaction.options.getBoolean('skip-animations')

    const isBetValid = checkValidBet(
      interaction,
      parsedBetAmount,
      configReply.casinoSettings.slots.maxBet,
      configReply.casinoSettings.slots.minBet
    )

    if (!isBetValid) return

    totalBet = parsedBetAmount * spins
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

    let totalWinnings = 0
    let liveResult = 0
    const results: string[] = []

    await interaction.deferReply()

    for (let i = 0; i < spins; i++) {
      if (!skipAnimations) {
        await interaction.editReply({
          embeds: [
            createBetEmbed(
              `🎰 Spinning...`,
              'Blue',
              `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
                `🕹 Spin Results:\n${results.join('\n')}${
                  results.length ? '\n' : ''
                }${spinSlotEmotes[1]}${spinSlotEmotes[2]}${spinSlotEmotes[3]}` +
                `\n\n💰 Total: ${
                  liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                } **$${formatNumberToReadableString(liveResult)}**`,
              betId
            )
          ]
        })

        await new Promise((res) => setTimeout(res, 700))
      }

      const spinResult = spinSlot({
        symbolWeights: configReply.casinoSettings.slots.symbolWeights
      })

      const resultString = spinResult.replace(
        /🍒|🫐|🍉|🔔|7️⃣/g,
        (match) => slotEmojis[match]
      )

      const winnings =
        (configReply.casinoSettings.slots.winMultipliers[spinResult] || 0) *
        parsedBetAmount
      const isWin = winnings > 0

      results.push(
        `**${resultString}** | ${isWin ? '🎉' : '❌'} | ${
          isWin
            ? `**+$${formatNumberToReadableString(winnings)}**`
            : `**-$${readableBetAmount}**`
        }`
      )

      totalWinnings += winnings
      liveResult += winnings - parsedBetAmount
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
            ? '🎰 **Win!** 🎉'
            : isLoss
              ? '🎰 **Better Luck Next Time...** ❌'
              : '🎰 **Not Bad...** 👀',
          isWin ? 'Green' : isLoss ? 'Red' : 'Yellow',
          `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
            `🕹 **Spin Results:**\n${results.join('\n')}\n\n` +
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
