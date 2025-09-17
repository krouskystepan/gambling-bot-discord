import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'
import { createBetEmbed, createErrorEmbed } from '../../../utils/createEmbed'
import {
  checkChannelConfiguration,
  parseReadableStringToNumber,
  formatNumberToReadableString,
  checkUserRegistration,
  checkValidBet,
  generateBetId,
} from '../../../utils/utils'
import { flipCoin } from '../../../utils/casinoHelpers'
import { flipCoinEmote, coinEmojis } from '../../../utils/customEmotes'
import Transaction from '../../../models/Transaction'

export const data: CommandData = {
  name: 'coin-flip',
  description: 'Flip a coin!',
  options: [
    {
      name: 'bet',
      description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'side',
      description: 'Choose the coin side.',
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: 'Heads', value: 'heads' },
        { name: 'Tails', value: 'tails' },
      ],
    },
    {
      name: 'flips',
      description: 'Number of flips.',
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

    const flips = interaction.options.getInteger('flips') || 1
    const side = interaction.options.getString('side', true)
    const betAmount = interaction.options.getString('bet', true)
    const parsedBetAmount = parseReadableStringToNumber(betAmount)
    const readableBetAmount = formatNumberToReadableString(parsedBetAmount)
    const showBalance = interaction.options.getBoolean('show-balance')
    const skipAnimations = interaction.options.getBoolean('skip-animations')

    const isBetValid = checkValidBet(
      interaction,
      parsedBetAmount,
      configReply.casinoSettings.coinflip.maxBet,
      configReply.casinoSettings.coinflip.minBet,
      user.balance,
      flips
    )

    if (!isBetValid) return

    const betId = generateBetId()

    const totalBet = parsedBetAmount * flips

    user.balance -= totalBet
    await Transaction.create({
      userId: user.userId,
      guildId: user.guildId,
      amount: totalBet,
      type: 'bet',
      source: 'casino',
      betId,
      createdAt: new Date(),
    })

    let totalWinnings = 0
    let liveResult = 0
    const results: string[] = []

    await interaction.deferReply({ withResponse: true })

    for (let i = 0; i < flips; i++) {
      if (!skipAnimations) {
        await interaction.editReply({
          embeds: [
            createBetEmbed(
              `🪙 Flipping...`,
              'Blue',
              `💵 Total Bet: **$${formatNumberToReadableString(
                totalBet
              )}**\n\n` +
                `🪙 **Flip Results:**\n${[...results, flipCoinEmote].join(
                  '\n'
                )}` +
                `\n\n💰 Total: ${
                  liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                } **$${formatNumberToReadableString(liveResult)}**`,
              betId
            ),
          ],
        })

        await new Promise((res) => setTimeout(res, 700))
      }

      const flipResult = flipCoin()
      const win = side === flipResult
      const winnings = win
        ? parsedBetAmount * configReply.casinoSettings.coinflip.winMultiplier
        : 0

      results.push(
        `${coinEmojis[flipResult]} | ${win ? '🎉' : '❌'} | ${
          win
            ? `**+$${formatNumberToReadableString(winnings)}**`
            : `**-$${readableBetAmount}**`
        }`
      )

      totalWinnings += winnings
      liveResult += winnings - parsedBetAmount
    }

    user.balance += totalWinnings
    await user.save()

    if (totalWinnings > 0) {
      await Transaction.create({
        userId: user.userId,
        guildId: user.guildId,
        amount: totalWinnings,
        type: 'win',
        source: 'casino',
        betId,
        createdAt: new Date(),
      })
    }

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
          `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
            `🪙 **Flip Results:**\n${results.join('\n')}\n\n` +
            `💰 Total: ${
              isWin ? '🟢' : isLoss ? '🔴' : '🟡'
            } **$${formatNumberToReadableString(liveResult)}**\n` +
            (showBalance
              ? `🏦 Balance: **$${formatNumberToReadableString(user.balance)}**`
              : ''),
          betId
        ),
      ],
    })
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
