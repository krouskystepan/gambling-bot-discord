import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import { ApplicationCommandOptionType } from 'discord.js'
import { createBetEmbed } from '../../../utils/createEmbed'
import { spinSlot } from '../../../utils/casinoHelpers'
import {
  parseReadableStringToNumber,
  formatNumberToReadableString,
  formatNumberWithSpaces,
} from '../../../utils/utils'
import { SLOT_MAX_SIMULATE_SPINS } from '../../../utils/defaultConfig'
import GuildConfiguration from '../../../models/GuildConfiguration'

export const data: CommandData = {
  name: 'simulate-slots',
  description:
    'Simulate X spins on a slot machine. WARNING: May take a long time!',
  options: [
    {
      name: 'spins',
      description: 'Number of spins you want to simulate.',
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
    {
      name: 'weights',
      description: 'Displays symbol weights.',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
  ],
  dm_permission: false,
}

export const options: CommandOptions = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  deleted: false,
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    const config = await GuildConfiguration.findOne({
      guildId: interaction.guildId,
    })

    const settings = config?.casinoSettings

    if (!settings) return

    await interaction.deferReply()

    let totalBet = 0
    let totalWinnings = 0
    let wins = 0
    let losses = 0
    let winCounts: Record<string, number> = {}

    let currentWinningStreak = 0
    let biggestWinningStreak = 0
    let currentLosingStreak = 0
    let biggestLosingStreak = 0

    const spins = parseReadableStringToNumber(
      interaction.options.getString('spins', true)
    )

    if (spins > SLOT_MAX_SIMULATE_SPINS) {
      return interaction.editReply({
        content: `The maximum number of spins is ${formatNumberToReadableString(
          SLOT_MAX_SIMULATE_SPINS
        )}.`,
      })
    }

    const bet = parseReadableStringToNumber(
      interaction.options.getString('bet', true)
    )
    const details = interaction.options.getBoolean('details')
    const winsLosses = interaction.options.getBoolean('wins-losses-count')
    const winLossesSeries = interaction.options.getBoolean('win-losses-series')
    const multipliers = interaction.options.getBoolean('multipliers')
    const weights = interaction.options.getBoolean('weights')

    await interaction.editReply(
      `Simulating **${formatNumberToReadableString(
        spins
      )}** spins with a bet of **$${formatNumberToReadableString(
        bet
      )}**. Please wait...`
    )

    const startTime = performance.now()

    for (let i = 1; i <= spins; i++) {
      totalBet += bet
      const resultString = spinSlot(settings.slots)
      let winnings = 0

      if (settings.slots.winMultipliers[resultString]) {
        winnings = bet * settings.slots.winMultipliers[resultString]
        wins++
        winCounts[resultString] = (winCounts[resultString] || 0) + 1

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

    const winLossesDetails =
      `🎉 Wins: **${formatNumberWithSpaces(wins)}**\n` +
      `❌ Losses: **${formatNumberWithSpaces(losses)}**`

    const winLossesSeriesDetails =
      `🔥 Longest winning streak: **${biggestWinningStreak}**\n` +
      `💀 Longest losing streak: **${biggestLosingStreak}**`

    const winDetails = Object.entries(winCounts)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([symbol, count]) => `${symbol}: **${formatNumberWithSpaces(count)}**x`
      )
      .join('\n')

    const multipliersDetails = Object.entries(settings.slots.winMultipliers)
      .map(([symbol, multiplier]) => `${symbol}: **${multiplier}**x`)
      .join('\n')

    const symbolWeightsDetails = Object.entries(settings.slots.symbolWeights)
      .map(([symbol, weight]) => `${symbol}: **${weight}**`)
      .join('\n')

    const totalTime = ((endTime - startTime) / 1000).toFixed(2)

    const embed = createBetEmbed(
      `🎰 Slot Simulation - ${formatNumberToReadableString(spins)} spins`,
      profitOrLoss >= 0 ? 'Green' : 'Red',
      `Total bet: **$${formatNumberToReadableString(totalBet)}**\n` +
        `Total: **$${formatNumberToReadableString(totalWinnings)}**\n` +
        `Profit/Loss: **$${formatNumberToReadableString(profitOrLoss)}**\n` +
        `Profit/Loss Percentage: **${profitOrLossPercentage.toFixed(2)}%**\n` +
        `📊 RTP: **${rtp.toFixed(2)}%**\n\n` +
        (winsLosses ? `${winLossesDetails}\n\n` : '') +
        (winLossesSeries ? `${winLossesSeriesDetails}\n\n` : '') +
        (details ? `Win details:\n${winDetails || 'No wins'}\n\n` : '') +
        (multipliers ? `Multipliers:\n${multipliersDetails}\n\n` : '') +
        (weights ? `Symbol weights:\n${symbolWeightsDetails}\n\n` : '') +
        `All spins took: **${totalTime}s**`
    )

    await interaction.editReply({
      content: `Simulation completed.`,
      embeds: [embed],
    })
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
