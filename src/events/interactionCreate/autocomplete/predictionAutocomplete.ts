import { Client, AutocompleteInteraction } from 'discord.js'
import Prediction from '../../../models/Prediction'

const formatDate = (date: Date) => {
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day}.${month} / ${hours}:${minutes}`
}

export default async (interaction: AutocompleteInteraction, client: Client) => {
  if (!interaction.isAutocomplete()) return
  if (interaction.commandName !== 'prediction') return

  const focusedOption = interaction.options.getFocused(true)
  const subcommand = interaction.options.getSubcommand()

  if (subcommand === 'end') {
    const focusedValue = focusedOption.value

    const predictions = await Prediction.find({
      guildId: interaction.guildId,
      status: 'active',
    }).limit(25)

    const filtered = predictions.filter((p) =>
      p.title.toLowerCase().includes(focusedValue.toLowerCase())
    )

    await interaction.respond(
      filtered.map((p) => ({
        name: `${p.title} • ${p.status.toUpperCase()} • ${formatDate(
          p.createdAt
        )}`,
        value: p.predictionId,
      }))
    )
  }

  if (subcommand === 'payout') {
    if (focusedOption.name === 'prediction-id') {
      const focusedValue = focusedOption.value

      const predictions = await Prediction.find({
        guildId: interaction.guildId,
        status: 'ended',
      }).limit(25)

      const filtered = predictions.filter((p) =>
        p.title.toLowerCase().includes(focusedValue.toLowerCase())
      )

      return await interaction.respond(
        filtered.map((p) => ({
          name: `${p.title} • ${p.status.toUpperCase()} • ${formatDate(
            p.createdAt
          )}`,
          value: p.predictionId,
        }))
      )
    }

    if (focusedOption.name === 'winner') {
      const predictionId = interaction.options.getString('prediction-id')
      if (!predictionId) {
        return await interaction.respond([])
      }

      const prediction = await Prediction.findOne({
        guildId: interaction.guildId,
        predictionId,
      })

      if (!prediction) {
        return await interaction.respond([])
      }

      const filteredChoices = prediction.choices
        .filter((c) =>
          c.choiceName.toLowerCase().includes(focusedOption.value.toLowerCase())
        )
        .map((c) => ({
          name: `${c.choiceName} (Odds: ${c.odds})`,
          value: c.choiceName,
        }))

      return await interaction.respond(filteredChoices)
    }
  }

  if (subcommand === 'cancel') {
    const focusedOption = interaction.options.getFocused(true)
    const focusedValue = focusedOption.value

    const predictions = await Prediction.find({
      guildId: interaction.guildId,
      status: { $in: ['active', 'ended'] },
    }).limit(25)

    const filtered = predictions.filter((p) =>
      p.title.toLowerCase().includes(focusedValue.toLowerCase())
    )

    const formatDate = (date: Date) => {
      const d = new Date(date)
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const hours = String(d.getHours()).padStart(2, '0')
      const minutes = String(d.getMinutes()).padStart(2, '0')
      return `${day}.${month} ${hours}:${minutes}`
    }

    await interaction.respond(
      filtered.map((p) => ({
        name: `${p.title} • ${p.status.toUpperCase()} • ${formatDate(
          p.createdAt
        )}`,
        value: p.predictionId,
      }))
    )
  }

  if (subcommand === 'check') {
    const focusedOption = interaction.options.getFocused(true)
    const focusedValue = focusedOption.value

    const predictions = await Prediction.find({
      guildId: interaction.guildId,
      status: { $in: ['active', 'ended', 'paid'] },
    }).limit(25)

    const filtered = predictions.filter((p) =>
      p.title.toLowerCase().includes(focusedValue.toLowerCase())
    )

    const formatDate = (date: Date) => {
      const d = new Date(date)
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const hours = String(d.getHours()).padStart(2, '0')
      const minutes = String(d.getMinutes()).padStart(2, '0')
      return `${day}.${month} ${hours}:${minutes}`
    }

    await interaction.respond(
      filtered.map((p) => ({
        name: `${p.title} • ${p.status.toUpperCase()} • ${formatDate(
          p.createdAt
        )}`,
        value: p.predictionId,
      }))
    )
  }
}
