import {
  LOTTERY_MAX_SIMULATE_ENTRIES,
  formatMoney,
  formatNumberToReadableString,
  formatNumberWithSpaces,
  parseReadableStringToNumber
} from 'gambling-bot-shared'

import { ApplicationCommandOptionType } from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import { assertGlobalFeature, getGuildConfigByGuildId } from '@/services'
import { drawLottery } from '@/utils/casino/rng'
import { DEV_GUILDS } from '@/utils/devGuilds'
import { createBetEmbed } from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'simulate-lottery',
  description: 'Simulate X lottery entries. WARNING: May take a long time!',
  options: [
    {
      name: 'entries',
      description: 'Number of entries.',
      type: ApplicationCommandOptionType.String,
      required: true
    },
    {
      name: 'bet',
      description: 'Enter a bet (e.g. 1000, 2k, 4.5k).',
      type: ApplicationCommandOptionType.String,
      required: true
    },
    {
      name: 'details',
      description: 'Displays win details.',
      type: ApplicationCommandOptionType.Boolean,
      required: false
    },
    {
      name: 'wins-losses-count',
      description: 'Displays the count of wins and losses.',
      type: ApplicationCommandOptionType.Boolean,
      required: false
    },
    {
      name: 'win-losses-series',
      description: 'Displays the longest winning and losing streak.',
      type: ApplicationCommandOptionType.Boolean,
      required: false
    }
  ],
  dm_permission: false
}

export const metadata: CommandMetadata = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  guilds: DEV_GUILDS
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const config = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })

    const settings = config?.casinoSettings

    if (!settings) return
    if (
      !(await assertGlobalFeature(interaction, config, 'casinoGamesForMods'))
    ) {
      return
    }

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

    const entries = parseReadableStringToNumber(
      interaction.options.getString('entries', true)
    )

    if (entries > LOTTERY_MAX_SIMULATE_ENTRIES) {
      return interaction.editReply({
        content: `The maximum number of entries is ${formatNumberToReadableString(
          LOTTERY_MAX_SIMULATE_ENTRIES
        )}.`
      })
    }

    const bet = parseReadableStringToNumber(
      interaction.options.getString('bet', true)
    )
    const details = interaction.options.getBoolean('details')
    const winsLosses = interaction.options.getBoolean('wins-losses-count')
    const winLossesSeries = interaction.options.getBoolean('win-losses-series')

    await interaction.editReply(
      `Simulating **${formatNumberToReadableString(
        entries
      )}** entries with a bet of **${formatMoney(bet, config.globalSettings)}**. Please wait...`
    )

    const startTime = performance.now()

    const userNumbers = [6, 13, 22, 34]

    for (let i = 1; i <= entries; i++) {
      totalBet += bet
      const lotteryNumbers = drawLottery()
      let winnings = 0

      const matchedNumbers = userNumbers.filter((n: number) =>
        lotteryNumbers.includes(n)
      ).length

      const matchKey =
        matchedNumbers as keyof typeof settings.lottery.winMultipliers

      winnings = bet * settings.lottery.winMultipliers[matchKey]

      if (settings.lottery.winMultipliers[matchKey]) {
        wins++
        winCounts[matchedNumbers] = (winCounts[matchedNumbers] || 0) + 1

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

    const totalTime = ((endTime - startTime) / 1000).toFixed(2)

    const embed = createBetEmbed(
      `🎟️ Lottery Simulation - ${formatNumberToReadableString(entries)} entries`,
      profitOrLoss >= 0 ? 'Green' : 'Red',
      `Total bet: **${formatMoney(totalBet, config.globalSettings)}**\n` +
        `Total: **${formatMoney(totalWinnings, config.globalSettings)}**\n` +
        `Profit/Loss: **${formatMoney(profitOrLoss, config.globalSettings)}**\n` +
        `Profit/Loss Percentage: **${profitOrLossPercentage.toFixed(2)}%**\n` +
        `📊 RTP: **${rtp.toFixed(2)}%**\n\n` +
        (winsLosses ? `${winLossesDetails}\n\n` : '') +
        (winLossesSeries ? `${winLossesSeriesDetails}\n\n` : '') +
        (details ? `Win details:\n${winDetails || 'No wins'}\n\n` : '') +
        `All entries took: **${totalTime}s**`
    )

    await interaction.editReply({
      content: `Simulation completed.`,
      embeds: [embed]
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
