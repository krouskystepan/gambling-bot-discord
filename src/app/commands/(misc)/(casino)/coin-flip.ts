import { shouldAnnounceByMultiplier } from 'gambling-bot-shared/casino'
import {
  formatMoney,
  generateId,
  parseReadableStringToNumber
} from 'gambling-bot-shared/common'

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
import { flipCoin } from '@/utils/casino/rng'
import { isUserOnCooldown } from '@/utils/common/userCooldown'
import { checkValidBet } from '@/utils/common/utils'
import { createBetEmbed, createErrorEmbed } from '@/utils/discord/createEmbed'
import { coinEmojis, flipCoinEmote } from '@/utils/discord/customEmotes'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

export const command: CommandData = {
  name: 'coin-flip',
  description: 'Flip a coin!',
  options: [
    {
      name: 'bet',
      description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
      type: ApplicationCommandOptionType.String,
      required: true
    },
    {
      name: 'side',
      description: 'Choose the coin side.',
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: 'Heads', value: 'heads' },
        { name: 'Tails', value: 'tails' }
      ]
    },
    {
      name: 'flips',
      description: 'Number of flips.',
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

    const flips = interaction.options.getInteger('flips') || 1
    const side = interaction.options.getString('side', true)
    const betAmount = interaction.options.getString('bet', true)
    const parsedBetAmount = parseReadableStringToNumber(betAmount)
    const showBalance = interaction.options.getBoolean('show-balance')
    const skipAnimations = interaction.options.getBoolean('skip-animations')

    const isBetValid = checkValidBet(
      interaction,
      parsedBetAmount,
      configReply.casinoSettings.coinflip.maxBet,
      configReply.casinoSettings.coinflip.minBet,
      configReply.globalSettings
    )
    if (!isBetValid) return

    totalBet = parsedBetAmount * flips
    betId = generateId()

    try {
      await reserveCasinoBet({
        userId,
        guildId,
        totalBet,
        betId,
        game: 'coinflip'
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
    const announcementFlips: string[] = []

    await interaction.deferReply()

    for (let i = 0; i < flips; i++) {
      if (!skipAnimations) {
        await interaction.editReply({
          embeds: [
            createBetEmbed(
              `🪙 Flipping...`,
              'Blue',
              `💵 Total Bet: **${formatMoney(totalBet, configReply.globalSettings)}**\n\n` +
                `🪙 **Flip Results:**\n${[...results, flipCoinEmote].join('\n')}` +
                `\n\n💰 Total: ${
                  liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                } **${formatMoney(liveResult, configReply.globalSettings)}**`,
              betId
            )
          ]
        })

        await new Promise((res) => setTimeout(res, 700))
      }

      const flipResult = flipCoin()
      const win = side === flipResult
      const flipMultiplier = win
        ? configReply.casinoSettings.coinflip.winMultiplier
        : 0
      const winnings = win ? parsedBetAmount * flipMultiplier : 0

      if (
        shouldAnnounceByMultiplier(
          flipMultiplier,
          configReply.casinoSettings.winAnnouncements.coinflipMinMultiplier
        )
      ) {
        announcementFlips.push(
          `Flip **${i + 1}** — ${coinEmojis[flipResult]} — **x${flipMultiplier.toFixed(2)}** → **${formatMoney(winnings, configReply.globalSettings)}** (bet **${formatMoney(parsedBetAmount, configReply.globalSettings)}**)`
        )
      }

      results.push(
        `${coinEmojis[flipResult]} | ${win ? '🎉' : '❌'} | ${
          win
            ? `**+${formatMoney(winnings, configReply.globalSettings)}**`
            : `**-${formatMoney(parsedBetAmount, configReply.globalSettings)}**`
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
      betId,
      game: 'coinflip'
    })
    betSettled = true

    tryAnnounceBigWin({
      guild: interaction.guild,
      guildConfig: configReply,
      userId,
      title: '🪙 Coin Flip Big Win!',
      intro: 'called it right!',
      lines: announcementFlips,
      betId,
      sourceChannelId: interaction.channelId
    })

    const isWin = liveResult > 0
    const isLoss = liveResult < 0

    await interaction.editReply({
      embeds: [
        createBetEmbed(
          isWin
            ? '🪙 **Win!** 🎉'
            : isLoss
              ? '🪙 **Better Luck Next Time...** ❌'
              : '🪙 **Not Bad...** 👀',
          isWin ? 'Green' : isLoss ? 'Red' : 'Yellow',
          `💵 Total Bet: **${formatMoney(totalBet, configReply.globalSettings)}**\n\n` +
            `🪙 **Flip Results:**\n${results.join('\n')}\n\n` +
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
          betId,
          game: 'coinflip'
        })
      } catch {}
    }

    await handleUnexpectedInteractionError(interaction, error)
  }
}
