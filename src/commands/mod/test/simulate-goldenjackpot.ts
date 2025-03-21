import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import { ApplicationCommandOptionType } from 'discord.js'
import { createBetEmbed } from '../../../utils/createEmbed'
import {
  parseReadableStringToNumber,
  formatNumberToReadableString,
  formatNumberWithSpaces,
} from '../../../utils/utils'
import {
  GOLDEN_JACKPOT_MAX_SIMULATE_ENTRIES,
  GOLDEN_JACKPOT_MULTIPLIER,
  GOLDEN_JACKPOT_ONE_IN_CHANCE,
} from '../../../utils/casinoConfig'
import { drawGoldenJackpot } from '../../../utils/casinoHelpers'

export const data: CommandData = {
  name: 'simulate-goldenjackpot',
  description:
    'Simulate X goldenjackpot entries. WARNING: May take a long time!',
  options: [
    {
      name: 'entries',
      description: 'Number of entries you want to simulate.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'bet',
      description: 'Enter a bet (e.g. 1000, 2k, 4.5k).',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'details',
      description: 'Displays win details.',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
    {
      name: 'wins-losses-count',
      description: 'Displays the count of wins and losses.',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
    {
      name: 'win-losses-series',
      description: 'Displays the longest winning and losing streak.',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
    {
      name: 'multipliers',
      description: 'Displays multipliers.',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
  ],
  contexts: [0],
}

export const options: CommandOptions = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  deleted: false,
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    await interaction.deferReply()

    let totalBet = 0
    let totalWinnings = 0
    let wins = 0
    let losses = 0

    let currentWinningStreak = 0
    let biggestWinningStreak = 0
    let currentLosingStreak = 0
    let biggestLosingStreak = 0

    const entries = parseReadableStringToNumber(
      interaction.options.getString('entries', true)
    )

    if (entries > GOLDEN_JACKPOT_MAX_SIMULATE_ENTRIES) {
      return interaction.editReply({
        content: `The maximum number of entries is **${formatNumberToReadableString(
          GOLDEN_JACKPOT_MAX_SIMULATE_ENTRIES
        )}**.`,
      })
    }

    const bet = parseReadableStringToNumber(
      interaction.options.getString('bet', true)
    )
    const winsLosses = interaction.options.getBoolean('wins-losses-count')
    const winLossesSeries = interaction.options.getBoolean('win-losses-series')
    const multipliers = interaction.options.getBoolean('multipliers')
    const details = interaction.options.getBoolean('details')

    await interaction.editReply(
      `Simulating **${formatNumberToReadableString(
        entries
      )}** entries with a bet of **$${formatNumberToReadableString(
        bet
      )}**. Please wait...`
    )

    const startTime = performance.now()

    for (let i = 1; i <= entries; i++) {
      totalBet += bet
      const jackpotNumber = drawGoldenJackpot()
      let winnings = 0

      if (jackpotNumber === 1) {
        winnings = bet * GOLDEN_JACKPOT_MULTIPLIER
        wins++

        currentLosingStreak = 0
        currentWinningStreak++
        if (currentWinningStreak > biggestWinningStreak) {
          biggestWinningStreak = currentWinningStreak
        }
      } else {
        losses++

        currentWinningStreak = 0
        currentLosingStreak++
        if (currentLosingStreak > biggestLosingStreak) {
          biggestLosingStreak = currentLosingStreak
        }
      }

      totalWinnings += winnings
    }

    const endTime = performance.now()

    await interaction.editReply(`Simulation complete. Generating results...`)

    const profitOrLoss = totalWinnings - totalBet
    const profitOrLossPercentage = (profitOrLoss / totalBet) * 100
    const rtp = (totalWinnings / totalBet) * 100

    const winDetails = `**1** in **${formatNumberWithSpaces(
      GOLDEN_JACKPOT_ONE_IN_CHANCE
    )}**`

    const winLossesDetails =
      `🎉 Wins: **${formatNumberWithSpaces(wins)}**\n` +
      `❌ Losses: **${formatNumberWithSpaces(losses)}**`

    const winLossesSeriesDetails =
      `🔥 Longest winning streak: **${biggestWinningStreak}**\n` +
      `💀 Longest losing streak: **${biggestLosingStreak}**`

    const multipliersDetails = `**${formatNumberWithSpaces(
      GOLDEN_JACKPOT_MULTIPLIER
    )}x**`

    const totalTime = ((endTime - startTime) / 1000).toFixed(2)

    const embed = createBetEmbed(
      `🤑 GoldenJackpot Simulation - ${formatNumberToReadableString(
        entries
      )} entries`,
      profitOrLoss >= 0 ? 'Green' : 'Red',
      `Total bet: **$${formatNumberToReadableString(totalBet)}**\n` +
        `Total: **$${formatNumberToReadableString(totalWinnings)}**\n` +
        `Profit/Loss: **$${formatNumberToReadableString(profitOrLoss)}**\n` +
        `Profit/Loss Percentage: **${profitOrLossPercentage.toFixed(2)}%**\n` +
        `📊 RTP: **${rtp.toFixed(2)}%**\n\n` +
        (winsLosses ? `${winLossesDetails}\n\n` : '') +
        (winLossesSeries ? `${winLossesSeriesDetails}\n\n` : '') +
        (details ? `Details: ${winDetails}\n\n` : '') +
        (multipliers ? `Multiplier: ${multipliersDetails}\n\n` : '') +
        `All entries took: **${totalTime}s**`
    )

    await interaction.editReply({
      content: `Simulation completed.`,
      embeds: [embed],
    })
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
