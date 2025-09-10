import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'
import {
  createBetEmbed,
  createErrorEmbed,
  createInfoEmbed,
} from '../../../utils/createEmbed'
import {
  checkChannelConfiguration,
  checkMilestones,
  checkUserRegistration,
  checkValidBet,
  formatNumberToReadableString,
  parseReadableStringToNumber,
} from '../../../utils/utils'
import { drawGoldenJackpot } from '../../../utils/casinoHelpers'

const GOLDEN_JACKPOT_MAX_ENTRIES = 100

export const data: CommandData = {
  name: 'goldenjackpot',
  description: `Try your luck at the Golden Jackpot HUGEx!`,
  options: [
    {
      name: 'bet',
      description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'entries',
      description: `Number of entries (max is ${GOLDEN_JACKPOT_MAX_ENTRIES}).`,
      type: ApplicationCommandOptionType.Integer,
      required: false,
    },
    {
      name: 'show-balance',
      description:
        'Displays the current balance (WARNING: VISIBLE TO EVERYONE)!',
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
    const showBalance = interaction.options.getBoolean('show-balance')

    if (entries > GOLDEN_JACKPOT_MAX_ENTRIES || entries < 1) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Entries',
            `The number of entries must be between 1 and ${GOLDEN_JACKPOT_MAX_ENTRIES}.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const isBetValid = checkValidBet(
      interaction,
      parsedBetAmount,
      configReply.casinoSettings.goldenJackpot.maxBet,
      configReply.casinoSettings.goldenJackpot.minBet,
      user.balance,
      entries
    )

    if (!isBetValid) return

    const totalBet = parsedBetAmount * entries

    user.balance -= totalBet
    user.amountGambled += totalBet
    user.milestoneProgress += totalBet
    await user.save()

    const initialTickets = entries
    let totalWinnings = 0
    let liveResult = 0
    let jackpotTries: string[] = []

    await interaction.deferReply({ withResponse: true })

    await interaction.editReply({
      embeds: [
        createBetEmbed(
          `🤑 Drawing...`,
          'Blue',
          `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
            `🎟️ Tickets left: **${initialTickets}**\n` +
            `\n💰 Total: ${
              liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
            } **$${formatNumberToReadableString(liveResult)}**`
        ),
      ],
    })
    await new Promise((res) => setTimeout(res, 1000))

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

      let ticketsLeft = initialTickets - tryNumber
      if (initialTickets > 10) {
        ticketsLeft = Math.ceil(ticketsLeft / step) * step
      }

      if (tryNumber % step === 0 || tryNumber === entries) {
        await interaction.editReply({
          embeds: [
            createBetEmbed(
              `🤑 Drawing...`,
              'Blue',
              `💵 Total Bet: **$${formatNumberToReadableString(
                totalBet
              )}**\n\n` +
                `🎟️ Tickets left: **${ticketsLeft}**\n` +
                (jackpotTries.length > 0
                  ? `\n**🤑 JACKPOT WINS:**\n${jackpotTries.join('\n')}\n`
                  : '') +
                `\n💰 Total: ${
                  liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'
                } **$${formatNumberToReadableString(liveResult)}**`
            ),
          ],
        })
        await new Promise((res) => setTimeout(res, 1000))
      }
    }

    user.balance += totalWinnings
    await user.save()

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
            `🤑 **Draw Result:**${
              isWin ? `\n ${jackpotTries.join('\n')}` : ' No win'
            }\n\n` +
            `💰 Total: ${
              isWin ? '🟢' : isLoss ? '🔴' : '🟡'
            } **$${formatNumberToReadableString(liveResult)}**\n` +
            (showBalance
              ? `🏦 Balance: **$${formatNumberToReadableString(user.balance)}**`
              : '')
        ),
      ],
    })

    // await checkMilestones(interaction, user, interaction.guildId!)
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
