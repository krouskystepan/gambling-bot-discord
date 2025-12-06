import { AutocompleteInteraction, Client } from 'discord.js'
import GuildConfiguration from '../../../models/GuildConfiguration'
import { readableGameValueNames } from 'gambling-bot-shared'

export default async (interaction: AutocompleteInteraction, client: Client) => {
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

  const filteredChoices = readableGameValueNames
    .filter((val) => settingKeys.includes(val.value))
    .filter((val) =>
      val.name.toLowerCase().startsWith(focusedValue.toLowerCase())
    )

  await interaction.respond(filteredChoices).catch(() => {})
}
