import { DateTime } from 'luxon'

import { AutocompleteCommand } from 'commandkit'

import { findPredictions, getPredictionById } from '@/services'

const formatDate = (date: Date) =>
  DateTime.fromJSDate(date).setZone('Europe/Prague').toFormat('dd.MM / HH:mm')

const autocomplete: AutocompleteCommand = async ({ interaction }) => {
  if (!interaction.isAutocomplete()) return
  if (interaction.commandName !== 'prediction') return

  const focusedOption = interaction.options.getFocused(true)
  const subcommand = interaction.options.getSubcommand()
  const focusedValue = focusedOption.value

  const searchPredictions = async (status: string | string[]) => {
    const query: Record<string, unknown> = {
      guildId: interaction.guildId,
      title: { $regex: focusedValue, $options: 'i' }
    }

    if (Array.isArray(status)) {
      query.status = { $in: status }
    } else {
      query.status = status
    }

    return findPredictions(query)
  }

  if (subcommand === 'end') {
    const predictions = await searchPredictions('active')

    return interaction.respond(
      predictions.length > 0
        ? predictions.map((p) => ({
            name: `${p.title} • ${p.status.toUpperCase()} • ${formatDate(p.createdAt)}`,
            value: p.predictionId
          }))
        : [{ name: 'No predictions found', value: 'none' }]
    )
  }

  if (subcommand === 'payout') {
    if (focusedOption.name === 'prediction-id') {
      const predictions = await searchPredictions('ended')

      return interaction.respond(
        predictions.length > 0
          ? predictions.map((p) => ({
              name: `${p.title} • ${p.status.toUpperCase()} • ${formatDate(p.createdAt)}`,
              value: p.predictionId
            }))
          : [{ name: 'No predictions found', value: 'none' }]
      )
    }

    if (focusedOption.name === 'winner') {
      const predictionId = interaction.options.getString('prediction-id')
      if (!predictionId) return interaction.respond([])

      const prediction = await getPredictionById({
        guildId: interaction.guildId!,
        predictionId
      })
      if (!prediction) return interaction.respond([])

      const filteredChoices = prediction.choices
        .filter((c) =>
          c.choiceName.toLowerCase().includes(focusedValue.toLowerCase())
        )
        .map((c) => ({
          name: `${c.choiceName} (Odds: ${c.odds})`,
          value: c.choiceName
        }))

      return interaction.respond(
        filteredChoices.length > 0
          ? filteredChoices
          : [{ name: 'No choices found', value: 'none' }]
      )
    }
  }

  if (subcommand === 'cancel') {
    const predictions = await searchPredictions(['active', 'ended'])

    return interaction.respond(
      predictions.length > 0
        ? predictions.map((p) => ({
            name: `${p.title} • ${p.status.toUpperCase()} • ${formatDate(p.createdAt)}`,
            value: p.predictionId
          }))
        : [{ name: 'No predictions found', value: 'none' }]
    )
  }

  if (subcommand === 'check') {
    const predictions = await searchPredictions(['active', 'ended'])

    return interaction.respond(
      predictions.length > 0
        ? predictions.map((p) => ({
            name: `${p.title} • ${p.status.toUpperCase()} • ${formatDate(p.createdAt)}`,
            value: p.predictionId
          }))
        : [{ name: 'No predictions found', value: 'none' }]
    )
  }
}

export default autocomplete
