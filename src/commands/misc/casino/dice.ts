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
import { rollDice } from '../../../utils/casinoHelpers'
import { rollDiceEmote, diceEmojis } from '../../../utils/customEmotes'
import Transaction from '../../../models/Transaction'

export const data: CommandData = {
  name: 'dice',
  description: 'Play a dice game!',
  options: [
    {
      name: 'bet',
      description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'side',
      description: 'Choose a dice side.',
      type: ApplicationCommandOptionType.Integer,
      required: true,
      choices: Array.from({ length: 6 }, (_, i) => ({
        name: (i + 1).toString(),
        value: i + 1,
      })),
    },
    {
      name: 'rolls',
      description: 'Number of rolls.',
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

    const rolls = interaction.options.getInteger('rolls') || 1
    const side = interaction.options.getInteger('side', true)
    const betAmount = interaction.options.getString('bet', true)
    const parsedBetAmount = parseReadableStringToNumber(betAmount)
    const readableBetAmount = formatNumberToReadableString(parsedBetAmount)
    const showBalance = interaction.options.getBoolean('show-balance')
    const skipAnimations = interaction.options.getBoolean('skip-animations')

    const isBetValid = checkValidBet(
      interaction,
      parsedBetAmount,
      configReply.casinoSettings.dice.maxBet,
      configReply.casinoSettings.dice.minBet,
      user.balance,
      rolls
    )

    if (!isBetValid) return

    const betId = generateBetId()

    const totalBet = parsedBetAmount * rolls

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

    await interaction.deferReply({
      withResponse: true,
    })

    for (let i = 0; i < rolls; i++) {
      if (!skipAnimations) {
        await interaction.editReply({
          embeds: [
            createBetEmbed(
              `🎲 Rolling...`,
              'Blue',
              `💵 Total Bet: **$${formatNumberToReadableString(
                totalBet
              )}**\n\n` +
                `🎲 **Roll Results:**\n${[...results, rollDiceEmote].join(
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

      const dice = rollDice()
      const win = side === dice
      const winnings = win
        ? parsedBetAmount * configReply.casinoSettings.dice.winMultiplier
        : 0

      results.push(
        `${diceEmojis[dice]} | ${win ? '🎉' : '❌'} | ${
          win
            ? `+$${formatNumberToReadableString(winnings)}`
            : `-$${readableBetAmount}`
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
            ? '🎲 **Win!** 🎉'
            : isLoss
            ? '🎲 **Better Luck Next Time...** ❌'
            : '🎲 **Not Bad...** 👀',
          isWin ? 'Green' : isLoss ? 'Red' : 'Yellow',
          `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
            `🎲 **Roll Results:**\n${results.join('\n')}\n\n` +
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
