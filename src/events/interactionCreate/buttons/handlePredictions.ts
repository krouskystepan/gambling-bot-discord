import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  Interaction,
} from 'discord.js'
import User from '../../../models/User'
import Prediction from '../../../models/Prediction'
import { createInfoEmbed, createSuccessEmbed } from '../../../utils/createEmbed'
import {
  parseReadableStringToNumber,
  formatNumberToReadableString,
} from '../../../utils/utils'
import GuildConfiguration from '../../../models/GuildConfiguration'

export default async (interaction: Interaction) => {
  if (!interaction.isButton() || !interaction.customId) return

  try {
    const [type, predictionId, choiceName, odds] =
      interaction.customId.split('.')

    if (type !== 'prediction' || !predictionId || !choiceName || !odds) return

    const targetPrediction = await Prediction.findOne({
      predictionId,
      guildId: interaction.guildId,
    })
    if (!targetPrediction || !interaction.channel) return
    if (targetPrediction.status !== 'active') {
      return await interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Not active',
            'This prediction is not active.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const modal = new ModalBuilder()
      .setTitle(`Place your bet on ${choiceName}.`)
      .setCustomId(
        `prediction-${predictionId}-${choiceName}-${interaction.user.id}`
      )

    const textInput = new TextInputBuilder()
      .setCustomId(`bet-${predictionId}-input-${interaction.user.id}`)
      .setLabel('How much would you like to bet?')
      .setPlaceholder('e.g. 1000, 4k, 10.5k')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(textInput)
    )

    await interaction.showModal(modal)

    const modalInteraction = await interaction
      .awaitModalSubmit({
        filter: (i) =>
          i.customId.startsWith(`prediction-${predictionId}-${choiceName}`) &&
          i.user.id === interaction.user.id,
        time: 60000,
      })
      .catch(() => null)

    if (!modalInteraction) return

    await modalInteraction.deferReply({ flags: MessageFlags.Ephemeral })

    const betAmount = modalInteraction.fields.getTextInputValue(
      `bet-${predictionId}-input-${modalInteraction.user.id}`
    )
    const parsedBetAmount = parseReadableStringToNumber(betAmount)

    if (isNaN(parsedBetAmount) || parsedBetAmount <= 0) {
      return modalInteraction.editReply({
        embeds: [
          createInfoEmbed(
            'Invalid Input',
            'Please enter a valid positive number.'
          ),
        ],
      })
    }

    const guildConfiguration = await GuildConfiguration.findOne({
      guildId: interaction.guildId,
    })
    const casinoSettings = guildConfiguration?.casinoSettings

    if (!casinoSettings) return

    if (
      casinoSettings.prediction.maxBet > 0 &&
      parsedBetAmount > casinoSettings.prediction.maxBet
    ) {
      return modalInteraction.editReply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Above Maximum Bet',
            `The maximum bet is **$${formatNumberToReadableString(
              casinoSettings.prediction.maxBet
            )}**.`
          ),
        ],
      })
    }

    if (
      casinoSettings.prediction.minBet > 0 &&
      parsedBetAmount < casinoSettings.prediction.minBet
    ) {
      return modalInteraction.editReply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Below Minimum Bet',
            `The minimum bet is **$${formatNumberToReadableString(
              casinoSettings.prediction.minBet
            )}**.`
          ),
        ],
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
      return modalInteraction.editReply({
        embeds: [
          createInfoEmbed(
            'Insufficient Funds',
            `You don't have enough money to place this bet.`
          ),
        ],
      })
    }

    await Prediction.findOneAndUpdate(
      {
        predictionId,
        guildId: modalInteraction.guildId,
        'choices.choiceName': choiceName,
      },
      {
        $push: {
          'choices.$.bets': {
            userId: modalInteraction.user.id,
            amount: parsedBetAmount,
          },
        },
      }
    )

    await modalInteraction.editReply({
      embeds: [
        createSuccessEmbed(
          'Bet Placed Successfully',
          `You placed **$${formatNumberToReadableString(
            parsedBetAmount
          )}** on **${choiceName}**`
        ),
      ],
    })
  } catch (error) {
    console.error('Error in handlePrediction.ts', error)
  }
}
