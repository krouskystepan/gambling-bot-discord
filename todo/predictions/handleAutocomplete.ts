import { Interaction } from 'discord.js'
import Prediction from '../../../models/Prediction'

export default async (interaction: Interaction) => {
  if (!interaction.isAutocomplete()) return
  if (interaction.commandName !== 'prediction') return

  const subcommand = interaction.options.getSubcommand()

  if (subcommand === 'create') return

  if (subcommand === 'end') {
    const predictions = await Prediction.find({
      status: { $in: ['active'] },
    })

    const focusedValue = interaction.options.getFocused()

    const filteredPredictions = predictions.filter((prediction) =>
      prediction.title.toLowerCase().includes(focusedValue.toLowerCase())
    )

    const results = filteredPredictions.map((prediction) => {
      return {
        name: `${prediction.title} (${
          prediction.status
        }), Vytvořena: ${new Date(prediction.createdAt).toLocaleString(
          'cs-CZ'
        )}`,
        value: prediction.predictionId,
      }
    })

    interaction.respond(results.slice(0, 10)).catch(() => {})
  }

  if (subcommand === 'payout') {
    const predictions = await Prediction.find({
      status: { $in: ['ended'] },
    })

    const focusedValue = interaction.options.getFocused(true)

    let filteredPredictions: any[] = []
    if (focusedValue.name === 'prediction') {
      filteredPredictions = predictions.filter((prediction) =>
        prediction.title
          .toLowerCase()
          .includes(focusedValue.value.toLowerCase())
      )

      const results = filteredPredictions.map((prediction) => {
        return {
          name: `${prediction.title} (${
            prediction.status
          }), Vytvořena: ${new Date(prediction.createdAt).toLocaleString(
            'cs-CZ'
          )}`,
          value: prediction.predictionId,
        }
      })

      interaction.respond(results.slice(0, 10)).catch(() => {})
    }

    if (focusedValue.name === 'pick-winner') {
      const predictionId = interaction.options.getString('prediction', true)

      const targetPrediction = await Prediction.findOne({ predictionId })

      if (!targetPrediction) {
        return interaction.respond([])
      }

      const filteredWinners = targetPrediction.choices.filter((choice) =>
        choice.choiceName
          .toLowerCase()
          .includes(focusedValue.value.toLowerCase())
      )

      const results = filteredWinners.map((winner) => {
        return {
          name: `${winner.choiceName} (${winner.odds}x)`,
          value: winner.choiceName,
        }
      })

      interaction.respond(results.slice(0, 10)).catch(() => {})
    }
  }
}
