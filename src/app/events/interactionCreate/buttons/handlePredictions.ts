import {
  ActionRowBuilder,
  Interaction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js'

import { getGuildConfigByGuildId, getPredictionById } from '@/services'
import {
  PlacePredictionBetError,
  placePredictionBet
} from '@/services/predictions/placePredictionBet.service'
import {
  formatNumberToReadableString,
  parseReadableStringToNumber
} from '@/utils/common/utils'
import {
  createInfoEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export default async (interaction: Interaction) => {
  if (!interaction.isButton() || !interaction.customId) return

  try {
    const [type, predictionId, choiceName, odds] =
      interaction.customId.split('.')

    if (type !== 'prediction' || !predictionId || !choiceName || !odds) return

    const targetPrediction = await getPredictionById({
      predictionId,
      guildId: interaction.guildId!
    })
    if (!targetPrediction || !interaction.channel) return
    if (targetPrediction.status !== 'active') {
      return await interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Not Active',
            'This prediction is not active.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (!targetPrediction.choices || targetPrediction.choices.length === 0) {
      return await interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - No Choices',
            'This prediction has no choices available.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const targetChoice = targetPrediction.choices.find(
      (c) => c.choiceName === choiceName
    )
    if (!targetChoice) return

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
        time: 60000
      })
      .catch(() => null)

    if (!modalInteraction) return
    await modalInteraction.deferReply({ flags: MessageFlags.Ephemeral })

    const betAmountInput = modalInteraction.fields.getTextInputValue(
      `bet-${predictionId}-input-${modalInteraction.user.id}`
    )
    const parsedBetAmount = parseReadableStringToNumber(betAmountInput)

    if (isNaN(parsedBetAmount) || parsedBetAmount <= 0) {
      return modalInteraction.editReply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Non-positive number',
            'Please enter a valid positive number.'
          )
        ]
      })
    }

    const guildConfig = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })
    const casinoSettings = guildConfig?.casinoSettings
    if (!casinoSettings) return

    try {
      await placePredictionBet({
        userId: modalInteraction.user.id,
        guildId: interaction.guildId!,
        predictionId,
        choiceName,
        amount: parsedBetAmount,
        minBet: casinoSettings.prediction.minBet,
        maxBet: casinoSettings.prediction.maxBet
      })
    } catch (err: unknown) {
      if (err instanceof PlacePredictionBetError) {
        if (err.code === 'VALIDATION_FAILED') {
          if (err.message === 'ABOVE_MAX_PER_CHOICE') {
            const userChoiceTotal = targetChoice.bets
              .filter((bet) => bet.userId === modalInteraction.user.id)
              .reduce((sum, bet) => sum + bet.amount, 0)
            return modalInteraction.editReply({
              embeds: [
                createInfoEmbed(
                  'Invalid Input - Above Maximum Bet',
                  `The maximum bet per choice is **$${formatNumberToReadableString(
                    casinoSettings.prediction.maxBet
                  )}**. You already have **$${formatNumberToReadableString(
                    userChoiceTotal
                  )}** on **${choiceName}**.`
                )
              ]
            })
          }
          return modalInteraction.editReply({
            embeds: [
              createInfoEmbed(
                'Invalid Input - Below Minimum Bet',
                `The minimum bet is **$${formatNumberToReadableString(
                  casinoSettings.prediction.minBet
                )}**.`
              )
            ]
          })
        }
        if (err.code === 'PREDICTION_STATE_CHANGED') {
          return modalInteraction.editReply({
            embeds: [
              createInfoEmbed(
                'Bet Failed',
                'This prediction changed while placing your bet. Your funds were refunded.'
              )
            ]
          })
        }
      }
      throw err
    }

    await modalInteraction.editReply({
      embeds: [
        createSuccessEmbed(
          'Bet Placed Successfully',
          `You placed **$${formatNumberToReadableString(parsedBetAmount)}** on **${choiceName}**`
        )
      ]
    })
  } catch (error) {
    logger.error('Error in handlePrediction.ts', error)
  }
}
