import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  checkCasinoChannels,
  checkUserRegistration,
  createTransaction,
  updateUserBalance
} from '@/services'
import { drawLottery } from '@/utils/casino/rng'
import {
  checkValidBet,
  formatNumberToReadableString,
  generateBetId,
  parseReadableStringToNumber
} from '@/utils/common/utils'
import { createBetEmbed, createInfoEmbed } from '@/utils/discord/createEmbed'

export const data: CommandData = {
  name: 'lottery',
  description: 'Play the lottery! Pick 5 numbers and see if you win.',
  options: [
    {
      name: 'bet',
      description: 'Your bet amount (e.g., 100, 1k, 5k).',
      type: ApplicationCommandOptionType.String,
      required: true
    },
    {
      name: 'numbers',
      description:
        'Pick 4 numbers between 1-50, separated by commas (e.g., 3, 14, 25, 38).',
      type: ApplicationCommandOptionType.String,
      required: true
    },
    {
      name: 'entries',
      description: 'Number of entries.',
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
  try {
    const user = await checkUserRegistration({ interaction })
    if (!user) return

    const configReply = await checkCasinoChannels(interaction)
    if (!configReply) return

    const entries = interaction.options.getInteger('entries') || 1
    const betAmount = interaction.options.getString('bet', true)
    const parsedBetAmount = parseReadableStringToNumber(betAmount)
    const readableBetAmount = formatNumberToReadableString(parsedBetAmount)
    const showBalance = interaction.options.getBoolean('show-balance')
    const skipAnimations = interaction.options.getBoolean('skip-animations')

    const numbersInput = interaction.options.getString('numbers', true)
    const userNumbers = numbersInput.split(',').map((n) => parseFloat(n.trim()))

    if (
      userNumbers.length !== 4 ||
      userNumbers.some(
        (n) =>
          !Number.isInteger(n) ||
          n < 1 ||
          n > 50 ||
          new Set(userNumbers).size !== 4
      )
    ) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Invalid Numbers',
            'Pick 5 unique whole numbers between 1-50, separated by commas (e.g., 3, 14, 25, 38).'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const isBetValid = checkValidBet(
      interaction,
      parsedBetAmount,
      configReply.casinoSettings.lottery.maxBet,
      configReply.casinoSettings.lottery.minBet,
      user.balance,
      entries
    )

    if (!isBetValid) return

    const betId = generateBetId()

    const totalBet = parsedBetAmount * entries

    await updateUserBalance({
      userId: user.userId,
      guildId: user.guildId,
      amount: -totalBet,
      lockedAmount: -Math.min(user.lockedBalance, totalBet)
    })

    await createTransaction({
      userId: user.userId,
      guildId: user.guildId,
      amount: totalBet,
      type: 'bet',
      source: 'casino',
      betId
    })

    let totalWinnings = 0
    let liveResult = 0
    const results: string[] = []

    await interaction.deferReply({
      withResponse: true
    })

    for (let i = 0; i < entries; i++) {
      if (!skipAnimations) {
        await interaction.editReply({
          embeds: [
            createBetEmbed(
              `🎟️ Drawing...`,
              'Blue',
              `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
                `Your numbers: **${userNumbers
                  .map((n) => n.toString().padStart(2, '0'))
                  .join(', ')}**\n\n` +
                `🎟️ **Draw Results:**\n${[...results, '🎟️ Drawing...'].join('\n')}\n\n` +
                `💰 Total: ${
                  liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                } **$${formatNumberToReadableString(liveResult)}**`,
              betId
            )
          ]
        })

        await new Promise((res) => setTimeout(res, 700))
      }

      const lotteryNumbers = drawLottery()
      const resultString = lotteryNumbers
        .map((n) => n.toString().padStart(2, '0'))
        .join(', ')

      const matchedNumbers = userNumbers.filter((n) =>
        lotteryNumbers.includes(n)
      ).length

      const winnings =
        parsedBetAmount *
        configReply.casinoSettings.lottery.winMultipliers[matchedNumbers]

      results.push(
        `**${resultString}** | ${matchedNumbers > 0 ? `🎉 **${matchedNumbers}**` : `❌ **0**`} | ${
          winnings > parsedBetAmount
            ? `**+$${formatNumberToReadableString(winnings)}**`
            : winnings < parsedBetAmount
              ? `**-$${readableBetAmount}**`
              : `**$0**`
        }`
      )

      totalWinnings += winnings
      liveResult += winnings - parsedBetAmount
    }

    const updatedUser = await updateUserBalance({
      userId: user.userId,
      guildId: user.guildId,
      amount: totalWinnings
    })
    if (!updatedUser) return

    if (totalWinnings > 0) {
      await createTransaction({
        userId: user.userId,
        guildId: user.guildId,
        amount: totalWinnings,
        type: 'win',
        source: 'casino',
        betId
      })
    }

    const isWin = liveResult > 0
    const isLoss = liveResult < 0

    await interaction.editReply({
      embeds: [
        createBetEmbed(
          isWin
            ? '🎟️ **Win!** 🎉'
            : isLoss
              ? '🎟️ **Better Luck Next Time...** ❌'
              : '🎟️ **Not Bad...** 👀',
          isWin ? 'Green' : isLoss ? 'Red' : 'Yellow',
          `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
            `Your numbers: **${userNumbers
              .map((n) => n.toString().padStart(2, '0'))
              .join(', ')}**\n\n` +
            `🎟️ **Draw Results:**\n${results.join('\n')}\n\n` +
            `💰 Total: ${
              isWin ? '🟢' : isLoss ? '🔴' : '🟡'
            } **$${formatNumberToReadableString(liveResult)}**\n` +
            (showBalance
              ? `🏦 Balance: **$${formatNumberToReadableString(updatedUser.balance)}**`
              : ''),
          betId
        )
      ]
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
