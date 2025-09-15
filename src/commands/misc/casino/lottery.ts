import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'
import {
  createBetEmbed,
  createErrorEmbed,
  createInfoEmbed,
} from '../../../utils/createEmbed'
import {
  checkUserRegistration,
  parseReadableStringToNumber,
  formatNumberToReadableString,
  checkChannelConfiguration,
  checkValidBet,
} from '../../../utils/utils'
import { drawLottery } from '../../../utils/casinoHelpers'

export const data: CommandData = {
  name: 'lottery',
  description: 'Play the lottery! Pick 5 numbers and see if you win.',
  options: [
    {
      name: 'bet',
      description: 'Your bet amount (e.g., 100, 1k, 5k).',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'numbers',
      description:
        'Pick 4 numbers between 1-50, separated by commas (e.g., 3, 14, 25, 38).',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'entries',
      description: 'Number of entries.',
      type: ApplicationCommandOptionType.Integer,
      required: false,
      choices: Array.from({ length: 10 }, (_, i) => ({
        name: (i + 1).toString(),
        value: i + 1,
      })),
    },
    {
      name: 'show-balance',
      description:
        'Displays the current balance (WARNING: VISIBLE TO EVERYONE)!',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
    {
      name: 'skip-animations',
      description: 'Skip game animations for faster results.',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
  ],
  dm_permission: false,
}

export const options: CommandOptions = {
  deleted: false,
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    const user = await checkUserRegistration(
      interaction.user.id,
      interaction.guildId!
    )

    if (!user) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Not registered',
            'You are not registered yet.\nUse the `/register` command to register.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const configReply = await checkChannelConfiguration(
      interaction,
      'casinoChannelIds',
      {
        notSet:
          'This server has not been configured for betting commands yet.\nSet it up using web dashboard.',
        notAllowed: `This channel is not configured for betting commands.\nTry one of these channels:`,
      }
    )

    if (!configReply) return

    const entries = interaction.options.getInteger('entries') || 1
    const betAmount = interaction.options.getString('bet', true)
    const parsedBetAmount = parseReadableStringToNumber(betAmount)
    const readableBetAmount = formatNumberToReadableString(parsedBetAmount)
    const showBalance = interaction.options.getBoolean('show-balance')
    const skipAnimations = interaction.options.getBoolean('skip-animations')

    const isBetValid = checkValidBet(
      interaction,
      parsedBetAmount,
      configReply.casinoSettings.lottery.maxBet,
      configReply.casinoSettings.lottery.minBet,
      user.balance,
      entries
    )

    if (!isBetValid) return

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
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const totalBet = parsedBetAmount * entries

    user.balance -= totalBet

    let totalWinnings = 0
    let liveResult = 0
    const results: string[] = []

    await interaction.deferReply({
      withResponse: true,
    })

    for (let i = 0; i < entries; i++) {
      if (!skipAnimations) {
        await interaction.editReply({
          embeds: [
            createBetEmbed(
              `🎟️ Drawing...`,
              'Blue',
              `💵 Total Bet: **$${formatNumberToReadableString(
                totalBet
              )}**\n\n` +
                `Your numbers: **${userNumbers
                  .map((n) => n.toString().padStart(2, '0'))
                  .join(', ')}**\n\n` +
                `🎟️ **Draw Results:**\n${[...results, '🎟️ Drawing...'].join(
                  '\n'
                )}\n\n` +
                `💰 Total: ${
                  liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                } **$${formatNumberToReadableString(liveResult)}**`
            ),
          ],
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
        `**${resultString}** | ${
          matchedNumbers > 0 ? `🎉 **${matchedNumbers}**` : `❌ **0**`
        } | ${
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

    user.balance += totalWinnings
    user.netProfit += liveResult
    await user.save()

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
              ? `🏦 Balance: **$${formatNumberToReadableString(user.balance)}**`
              : '')
        ),
      ],
    })
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
