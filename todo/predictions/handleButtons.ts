import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  Interaction,
} from 'discord.js'
import Prediction from '../../../models/Prediction'
import { parseReadableStringToNumber } from '../../../utils/utils'
import User from '../../../models/User'

export default async (interaction: Interaction) => {
  if (!interaction.isButton() || !interaction.customId) return

  try {
    const [type, predictionId, choiceName, odds] =
      interaction.customId.split('.')

    if (!type || !predictionId || !choiceName || !odds) return
    if (type !== 'prediction') return

    const targetPrediction = await Prediction.findOne({ predictionId })
    if (!targetPrediction || !interaction.channel) return

    if (targetPrediction.status === 'ended') {
      return await interaction.reply({
        content: `❌ Tato příležitost už není aktivní.`,
        flags: MessageFlags.Ephemeral,
      })
    }

    const modal = new ModalBuilder()
      .setTitle(`Vsaď si částku na příležitost ${choiceName}.`)
      .setCustomId(`prediction-${predictionId}-${choiceName}`)

    const textInput = new TextInputBuilder()
      .setCustomId(`bet-${predictionId}-input`)
      .setLabel('Kolik by jsi chtěl vsadit?')
      .setPlaceholder('např. 1000, 4k, 10.5k')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
      textInput
    )

    modal.addComponents(actionRow)

    await interaction.showModal(modal)

    const modalInteraction = await interaction
      .awaitModalSubmit({
        filter: (i) =>
          i.customId === `prediction-${predictionId}-${choiceName}`,
        time: 60000,
      })
      .catch(() => null)

    if (!modalInteraction) return

    const betAmount = modalInteraction.fields
      .getTextInputValue(`bet-${predictionId}-input`)
      .toUpperCase()

    const parsedBetAmount = parseReadableStringToNumber(betAmount)

    if (isNaN(parsedBetAmount)) {
      return await modalInteraction.reply({
        content: `❌ Neplatná částka.`,
        flags: MessageFlags.Ephemeral,
      })
    }

    const updatedUser = await User.findOneAndUpdate(
      {
        userId: modalInteraction.user.id,
        guildId: modalInteraction.guildId,
        balance: { $gte: parsedBetAmount },
      },
      { $inc: { balance: -parsedBetAmount } },
      { new: true }
    )

    if (!updatedUser) {
      return await modalInteraction.reply({
        content: `❌ Nemáš dostatek peněz na vsazení $**${betAmount}**`,
        flags: MessageFlags.Ephemeral,
      })
    }

    const targetChoice = targetPrediction.choices.find(
      (choice) => choice.choiceName === choiceName
    )
    if (targetChoice) {
      targetChoice.bets.push({
        userId: updatedUser.userId,
        amount: parsedBetAmount,
      })
      await targetPrediction.save()
    }

    await modalInteraction.reply({
      content: `✅ Vsadil jsi $**${betAmount}** na **${choiceName}**`,
      flags: MessageFlags.Ephemeral,
    })
  } catch (error) {
    console.error('Error in handlePrediction.ts', error)
  }
}
