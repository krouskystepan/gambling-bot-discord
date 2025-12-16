import { readableGameValueNames } from 'gambling-bot-shared'

import { AutocompleteInteraction, Client } from 'discord.js'

import { getGuildConfigByGuildId } from '@/services'

export default async (
  interaction: AutocompleteInteraction,
  _client: Client
) => {
  if (!interaction.isAutocomplete()) return
  if (interaction.commandName !== 'setup-settings') return

  const focusedOption = interaction.options.getFocused(true)
  const game = interaction.options.getString('game')
  const focusedValue = focusedOption.value

  if (!game) return

  const config = await getGuildConfigByGuildId({
    guildId: interaction.guildId!
  })

  const gameSettings = config?.casinoSettings?.[game]

  if (!gameSettings) return

  const settingKeys = Object.keys(gameSettings)

  const filteredChoices = readableGameValueNames
    .filter((val) => settingKeys.includes(val.value))
    .filter((val) =>
      val.name.toLowerCase().startsWith(focusedValue.toLowerCase())
    )

  void interaction.respond(filteredChoices)
}
