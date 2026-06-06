import {
  formatMoney,
  generateId,
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
import { rollDice } from '@/utils/casino/rng'
import { isUserOnCooldown } from '@/utils/common/userCooldown'
import { checkValidBet } from '@/utils/common/utils'
import { createBetEmbed, createErrorEmbed } from '@/utils/discord/createEmbed'
import { diceEmojis, rollDiceEmote } from '@/utils/discord/customEmotes'

export const command: CommandData = {
  name: 'dice',
  description: 'Play a dice game!',
  options: [
    {
      name: 'bet',
      description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
      type: ApplicationCommandOptionType.String,
      required: true
    },
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
    {
      name: 'rolls',
      description: 'Number of rolls.',
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

    const rolls = interaction.options.getInteger('rolls') || 1
    const side = interaction.options.getInteger('side', true)
    const betAmount = interaction.options.getString('bet', true)
    const parsedBetAmount = parseReadableStringToNumber(betAmount)
    const showBalance = interaction.options.getBoolean('show-balance')
    const skipAnimations = interaction.options.getBoolean('skip-animations')

    const isBetValid = checkValidBet(
      interaction,
      parsedBetAmount,
      configReply.casinoSettings.dice.maxBet,
      configReply.casinoSettings.dice.minBet,
      configReply.globalSettings
    )

    if (!isBetValid) return

    totalBet = parsedBetAmount * rolls
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
              `You don't have enough money to place this bet.\nYour current balance is **${formatMoney(freshUser?.balance ?? 0, configReply.globalSettings)}**.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }
      throw err
    }

    let liveResult = 0
    const results: string[] = []

    await interaction.deferReply()

    for (let i = 0; i < rolls; i++) {
      if (!skipAnimations) {
        await interaction.editReply({
          embeds: [
            createBetEmbed(
              `🎲 Rolling...`,
              'Blue',
              `💵 Total Bet: **${formatMoney(totalBet, configReply.globalSettings)}**\n\n` +
                `🎲 **Roll Results:**\n${[...results, rollDiceEmote].join('\n')}` +
                `\n\n💰 Total: ${
                  liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                } **${formatMoney(liveResult, configReply.globalSettings)}**`,
              betId
            )
          ]
        })

        await new Promise((res) => setTimeout(res, 700))
      }

      const dice = rollDice()
      const win = side === dice
      const winnings = win
        ? parsedBetAmount * configReply.casinoSettings.dice.winMultiplier
        : 0

      const diceEmoji = diceEmojis[dice] ?? '🎲'

      results.push(
        `${diceEmoji} | ${win ? '🎉' : '❌'} | ${
          win
            ? `+${formatMoney(winnings, configReply.globalSettings)}`
            : `-${formatMoney(parsedBetAmount, configReply.globalSettings)}`
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
            ? '🎲 **Win!** 🎉'
            : isLoss
              ? '🎲 **Better Luck Next Time...** ❌'
              : '🎲 **Not Bad...** 👀',
          isWin ? 'Green' : isLoss ? 'Red' : 'Yellow',
          `💵 Total Bet: **${formatMoney(totalBet, configReply.globalSettings)}**\n\n` +
            `🎲 **Roll Results:**\n${results.join('\n')}\n\n` +
            `💰 Total: ${
              isWin ? '🟢' : isLoss ? '🔴' : '🟡'
            } **${formatMoney(liveResult, configReply.globalSettings)}**\n` +
            (showBalance
              ? `🏦 Balance: **${formatMoney(finalBalance, configReply.globalSettings)}**`
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
