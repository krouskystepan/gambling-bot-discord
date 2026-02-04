import { ApplicationCommandOptionType } from 'discord.js'

import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  checkCasinoChannels,
  checkUserRegistration,
  createTransaction,
  updateUserBalance
} from '@/services'
import { dropPlinkoPath, renderBoardFrame } from '@/utils/casino/plinko'
import {
  checkValidBet,
  formatNumberToReadableString,
  generateBetId,
  parseReadableStringToNumber
} from '@/utils/common/utils'
import { createBetEmbed } from '@/utils/discord/createEmbed'

export const data: CommandData = {
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
      choices: Array.from({ length: 5 }, (_, i) => ({
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

export const options: CommandOptions = {
  deleted: false
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    const user = await checkUserRegistration({ interaction })
    if (!user) return

    const configReply = await checkCasinoChannels(interaction)
    if (!configReply) return

    const balls = interaction.options.getInteger('balls') || 1
    const betInput = interaction.options.getString('bet', true)
    const betAmount = parseReadableStringToNumber(betInput)
    const showBalance = interaction.options.getBoolean('show-balance')
    const skipAnimations = interaction.options.getBoolean('skip-animations')

    const totalBet = betAmount * balls

    const isBetValid = checkValidBet(
      interaction,
      betAmount,
      configReply.casinoSettings.plinko.maxBet,
      configReply.casinoSettings.plinko.minBet,
      user.balance,
      balls
    )
    if (!isBetValid) return

    const betId = generateBetId()

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

    const { binMultipliers } = configReply.casinoSettings.plinko

    const bins = Object.keys(binMultipliers)
      .map(Number)
      .sort((a, b) => a - b)

    const rows = bins.length - 1

    let totalWinnings = 0
    let liveResult = 0
    const results: string[] = []

    await interaction.deferReply({ withResponse: true })

    for (let i = 0; i < balls; i++) {
      const path = dropPlinkoPath(rows)

      if (!skipAnimations) {
        for (let step = 0; step < path.length; step++) {
          await interaction.editReply({
            embeds: [
              createBetEmbed(
                `🎯 Ball ${i + 1} dropping...`,
                'Blue',
                `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
                  renderBoardFrame(rows, path[step], step, binMultipliers) +
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

      const finalBin = path[path.length - 1]
      const multiplier = binMultipliers[finalBin] ?? 0
      const formattedMultiplier = Number(multiplier).toFixed(2)
      const winnings = betAmount * multiplier
      const net = winnings - betAmount

      totalWinnings += winnings
      liveResult += net

      results.push(
        `Ball **${i + 1}** - x${formattedMultiplier} | ${
          net > 0
            ? `🎉 | **+$${formatNumberToReadableString(net)}**`
            : net < 0
              ? `❌ | **-$${formatNumberToReadableString(Math.abs(net))}**`
              : `➖ | **$0**`
        }`
      )
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
