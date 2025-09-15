import { Client, AutocompleteInteraction } from 'discord.js'
import Prediction from '../../../models/Prediction'
import { DateTime } from 'luxon'

const formatDate = (date: Date) =>
  DateTime.fromJSDate(date).setZone('Europe/Prague').toFormat('dd.MM / HH:mm')

export default async (interaction: AutocompleteInteraction, client: Client) => {
  if (!interaction.isAutocomplete()) return
  if (interaction.commandName !== 'prediction') return

  const focusedOption = interaction.options.getFocused(true)
  const subcommand = interaction.options.getSubcommand()
  const focusedValue = focusedOption.value

  const findPredictions = async (status: string | string[]) => {
    const query: Record<string, unknown> = {
      guildId: interaction.guildId,
      title: { $regex: focusedValue, $options: 'i' },
    }

    if (Array.isArray(status)) {
      query.status = { $in: status }
    } else {
      query.status = status
    }

    return await Prediction.find(query).limit(25)
  }

  if (subcommand === 'end') {
    const predictions = await findPredictions('active')

    return await interaction.respond(
      predictions.length > 0
        ? predictions.map((p) => ({
            name: `${p.title} • ${p.status.toUpperCase()} • ${formatDate(
              p.createdAt
            )}`,
            value: p.predictionId,
          }))
        : [{ name: 'No predictions found', value: 'none' }]
    )
  }

  if (subcommand === 'payout') {
    if (focusedOption.name === 'prediction-id') {
      const predictions = await findPredictions('ended')

      return await interaction.respond(
        predictions.length > 0
          ? predictions.map((p) => ({
              name: `${p.title} • ${p.status.toUpperCase()} • ${formatDate(
                p.createdAt
              )}`,
              value: p.predictionId,
            }))
          : [{ name: 'No predictions found', value: 'none' }]
      )
    }

    if (focusedOption.name === 'winner') {
      const predictionId = interaction.options.getString('prediction-id')
      if (!predictionId) return await interaction.respond([])

      const prediction = await Prediction.findOne({
        guildId: interaction.guildId,
        predictionId,
      })
      if (!prediction) return await interaction.respond([])

      const filteredChoices = prediction.choices
        .filter((c) =>
          c.choiceName.toLowerCase().includes(focusedValue.toLowerCase())
        )
        .map((c) => ({
          name: `${c.choiceName} (Odds: ${c.odds})`,
          value: c.choiceName,
        }))

      return await interaction.respond(
        filteredChoices.length > 0
          ? filteredChoices
          : [{ name: 'No choices found', value: 'none' }]
      )
    }
  }

  if (subcommand === 'cancel') {
    const predictions = await findPredictions(['active', 'ended'])

    return await interaction.respond(
      predictions.length > 0
        ? predictions.map((p) => ({
            name: `${p.title} • ${p.status.toUpperCase()} • ${formatDate(
              p.createdAt
            )}`,
            value: p.predictionId,
          }))
        : [{ name: 'No predictions found', value: 'none' }]
    )
  }

  if (subcommand === 'check') {
    const predictions = await findPredictions(['active', 'ended'])

    return await interaction.respond(
      predictions.length > 0
        ? predictions.map((p) => ({
            name: `${p.title} • ${p.status.toUpperCase()} • ${formatDate(
              p.createdAt
            )}`,
            value: p.predictionId,
          }))
        : [{ name: 'No predictions found', value: 'none' }]
    )
  }
}
