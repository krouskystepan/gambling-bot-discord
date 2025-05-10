import { Interaction, Client } from 'discord.js'
import GuildConfiguration from '../../models/GuildConfiguration'

const readableValues = [
  { name: 'Maximum Bet Amount', value: 'maxBet' },
  { name: 'Minimum Bet Amount', value: 'minBet' },
  { name: 'Win Percentage (%)', value: 'winPercentage' },
  { name: 'Win Multiplier/s (x)', value: 'winMultiplier' },
  { name: 'Casino House Cut (%)', value: 'casinoCut' },
  { name: 'One-In Chance (e.g. 1 in 10,000)', value: 'oneInChance' },
  // { name: 'Symbol Weights (Slots)', value: 'symbolWeights' },
]

export default async (interaction: Interaction, client: Client) => {
  if (!interaction.isAutocomplete()) return
  if (interaction.commandName !== 'setup-settings') return

  const focusedOption = interaction.options.getFocused(true)
  const game = interaction.options.getString('game')
  const focusedValue = focusedOption.value

  if (!game) return

  const config = await GuildConfiguration.findOne({
    guildId: interaction.guildId,
  })

  const gameSettings = config?.casinoSettings?.[game]

  if (!gameSettings) return

  const settingKeys = Object.keys(gameSettings)

  const filteredChoices = readableValues
    .filter((val) => settingKeys.includes(val.value))
    .filter((val) =>
      val.name.toLowerCase().startsWith(focusedValue.toLowerCase())
    )

  await interaction.respond(filteredChoices).catch(() => {})
}
