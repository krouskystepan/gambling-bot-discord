import { formatMoney } from 'gambling-bot-shared/common'
import {
  calculatePredictionPayoutSummary,
  getPredictionCheckSummary,
  parsePredictionAutolock,
  parsePredictionChoices
} from 'gambling-bot-shared/predictions'

import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  GuildTextBasedChannel,
  MessageFlags
} from 'discord.js'

import {
  AutocompleteCommand,
  ChatInputCommand,
  CommandData,
  CommandMetadata
} from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  assertGlobalFeature,
  checkPredictionChannels,
  createPrediction,
  findPredictions,
  getPredictionById
} from '@/services'
import {
  cancelPrediction,
  endPrediction,
  payPrediction
} from '@/services/predictions/payPrediction.service'
import { formatDate } from '@/utils/common/utils'
import { isGuildSendableChannel } from '@/utils/discord/channelGuards'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export const command: CommandData = {
  name: 'prediction',
  description: 'Manage predictions.',
  options: [
    {
      name: 'create',
      description: 'Create a new prediction.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'title',
          description: 'Title of the prediction',
          type: ApplicationCommandOptionType.String,
          required: true
        },
        {
          name: 'choices',
          description:
            'Comma-separated list of choices with odds (e.g. Yes:2,No:1.5,Maybe:3)',
          type: ApplicationCommandOptionType.String,
          required: true
        },
        {
          name: 'autolock',
          description:
            'Optional: Automatically lock this prediction at a specific date & time (DD-MM-YYYY HH:mm)',
          type: ApplicationCommandOptionType.String,
          required: false
        }
      ]
    },
    {
      name: 'end',
      description: 'End an active prediction so no more bets can be placed.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'prediction-id',
          description: 'ID of the prediction to end',
          type: ApplicationCommandOptionType.String,
          autocomplete: true,
          required: true
        }
      ]
    },
    {
      name: 'payout',
      description: 'Pay out winners of a prediction.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'prediction-id',
          description: 'ID of the prediction to payout',
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true
        },
        {
          name: 'winner',
          description: 'Name of the winning choice (full name)',
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true
        }
      ]
    },
    {
      name: 'cancel',
      description: 'Cancel a prediction and refund all bets.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'prediction-id',
          description: 'ID of the prediction to cancel',
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true
        }
      ]
    },
    {
      name: 'check',
      description: 'Check the status of a prediction.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'prediction-id',
          description: 'ID of the prediction to check',
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true
        }
      ]
    }
  ],
  dm_permission: false
}

export const metadata: CommandMetadata = {
  botPermissions: ['Administrator']
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const configReply = await checkPredictionChannels(interaction)

    if (!configReply) return
    if (
      !(await assertGlobalFeature(
        interaction,
        configReply,
        'predictionManagement'
      ))
    ) {
      return
    }

    const member = await interaction.guild?.members.fetch(interaction.user.id)
    const hasAdmin = member?.permissions.has('Administrator')
    const managerRoleId = configReply.managerRoleId
    const hasManager = managerRoleId && member?.roles.cache.has(managerRoleId)

    if (!hasAdmin && !hasManager) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Permission Denied',
            `You need to be an **Administrator** or have the ${
              managerRoleId ? `<@&${managerRoleId}>` : '**Manager role**'
            } to use this command.`
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const options = interaction.options
    const subcommand = options.getSubcommand()

    if (subcommand === 'create') {
      const title = options.getString('title', true)
      const choicesInput = options.getString('choices', true)
      const autolockInput = options.getString('autolock', false)

      const choicesResult = parsePredictionChoices(choicesInput)
      if (!choicesResult.ok) {
        const messages: Record<typeof choicesResult.error, string> = {
          INVALID_COUNT: 'You must provide **2 or 3 choices** only.',
          INVALID_FORMAT: `Invalid option format: "${choicesResult.detail ?? ''}". Use OptionName:Odds (e.g. Yes:2)`
        }

        return interaction.reply({
          embeds: [
            createErrorEmbed(
              choicesResult.error === 'INVALID_COUNT'
                ? 'Invalid Input - Wrong Number of Choices'
                : 'Invalid Input - Invalid Format',
              messages[choicesResult.error]
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const choicesArray = choicesResult.choices

      let autolockDate: Date | null = null
      if (autolockInput) {
        const autolockResult = parsePredictionAutolock(autolockInput)

        if (!autolockResult.ok) {
          const messages: Record<typeof autolockResult.error, string> = {
            INVALID_FORMAT:
              'Autolock must be in **D.M.YYYY HH:mm** or **DD.MM.YYYY HH:mm** format (24h). Example: `9.9.2025 05:00` or `09.09.2025 18:00`',
            INVALID_DATE: 'The date/time you provided is invalid.',
            PAST_DATE:
              'Autolock must be a future date/time. Please provide a date and time that is after now.'
          }

          return interaction.reply({
            embeds: [
              createErrorEmbed(
                'Invalid Input - Invalid Autolock Date/Time',
                messages[autolockResult.error]
              )
            ],
            flags: MessageFlags.Ephemeral
          })
        }

        autolockDate = autolockResult.autolock
      }

      await interaction.deferReply()
      const messageReply = await interaction.fetchReply()

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(
          choicesArray
            .map((c) => `- **${c.choiceName}** — ${c.odds}x`)
            .join('\n')
        )
        .setFooter({ text: `ID: ${messageReply.id}` })
        .setColor(Colors.Yellow)
        .setTimestamp()

      const row = new ActionRowBuilder<ButtonBuilder>()
      choicesArray.forEach((c) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(
              `prediction.${messageReply.id}.${c.choiceName}.${c.odds}`
            )
            .setLabel(c.choiceName)
            .setStyle(ButtonStyle.Primary)
        )
      })

      const autolockString = autolockDate
        ? `\nAuto-Lock: <t:${Math.floor(autolockDate.getTime() / 1000)}:f>`
        : ''

      await interaction.editReply({
        content: '**Status:** Active' + autolockString,
        embeds: [embed],
        components: [row]
      })

      await createPrediction({
        predictionId: messageReply.id,
        guildId: interaction.guildId!,
        channelId: interaction.channel?.id!,
        creatorId: interaction.user.id,
        title,
        choices: choicesArray,
        autolock: autolockDate,
        status: 'active'
      })

      logger.event(
        {
          action: 'prediction_create',
          actorId: interaction.user.id,
          predictionId: messageReply.id,
          guildId: interaction.guildId,
          title
        },
        'Admin created prediction'
      )
    }

    if (subcommand === 'end') {
      const predictionId = options.getString('prediction-id', true)

      const updatedPrediction = await endPrediction({
        predictionId,
        guildId: interaction.guildId!
      })

      if (!updatedPrediction) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Prediction Not Active or Not Found',
              `Prediction **${predictionId}** is either already ended/canceled or does not exist.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const channel = await interaction.client.channels.fetch(
        updatedPrediction.channelId
      )
      if (!channel || !channel.isTextBased()) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Channel Not Found',
              'Could not fetch the channel for this prediction.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const message = await channel.messages.fetch(
        updatedPrediction.predictionId
      )
      if (message) {
        const embed = message.embeds[0]?.toJSON() || {}
        const editedEmbed = {
          ...embed,
          color: Colors.Orange
        }
        await message.edit({
          content: '**Status:** Ended',
          embeds: [editedEmbed],
          components: []
        })
      }

      logger.event(
        {
          action: 'prediction_end',
          actorId: interaction.user.id,
          predictionId,
          guildId: interaction.guildId,
          title: updatedPrediction.title
        },
        'Admin ended prediction'
      )

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Prediction Ended',
            `Prediction **${updatedPrediction.title}** has ended.\n` +
              `No more bets can be placed.`
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (subcommand === 'payout') {
      if (!configReply?.predictionChannelIds.logs) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Logs Not Set Up',
              'Prediction logs are not configured yet.\nPlease complete the setup.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const predictionId = options.getString('prediction-id', true)
      const winnerChoice = options.getString('winner', true)

      const payoutResult = await payPrediction({
        predictionId,
        guildId: interaction.guildId!,
        winnerChoice
      })

      if (!payoutResult.ok) {
        const messages: Record<typeof payoutResult.code, string> = {
          NOT_FOUND: 'Prediction not found.',
          INVALID_STATUS: 'Prediction is not in ENDED state.',
          ALREADY_HANDLED:
            'Prediction payout is already in progress or completed.',
          INVALID_WINNER: `The winner "${winnerChoice}" does not exist in this prediction.`
        }

        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Prediction Payout Failed',
              messages[payoutResult.code]
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const { prediction, outcome } = payoutResult

      if (outcome === 'refunded') {
        return interaction.reply({
          embeds: [
            createSuccessEmbed(
              'Prediction Refunded',
              'No one bet on the winning option. All bets were refunded.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const winner = prediction.choices.find(
        (c) => c.choiceName === winnerChoice
      )!

      const logChannel = interaction
        .guild!.channels.fetch(configReply.predictionChannelIds.logs)
        .catch(() => null)

      if (!isGuildSendableChannel(logChannel)) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Wrong Discord Configuration',
              'Log channel misconfigured or inaccessible.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const sendableLogChannel = logChannel as GuildTextBasedChannel

      if (!sendableLogChannel) {
        logger.error(
          {
            predictionId,
            guildId: interaction.guildId,
            logChannelId: configReply.predictionChannelIds.logs
          },
          'Prediction payout log channel not found'
        )
      } else {
        const payoutSummary = calculatePredictionPayoutSummary(
          prediction,
          winnerChoice
        )

        if (!payoutSummary) {
          return interaction.reply({
            embeds: [
              createErrorEmbed(
                'Prediction Payout Failed',
                `The winner "${winnerChoice}" does not exist in this prediction.`
              )
            ],
            flags: MessageFlags.Ephemeral
          })
        }

        const { winners, losers, casinoProfit } = payoutSummary

        const winnersDisplay = await Promise.all(
          winners.map(async (w) => {
            const member = await interaction.guild?.members
              .fetch(w.userId)
              .catch(() => null)
            const username = member ? `<@${member.id}>` : 'Unknown'
            return `${username} (Bet: ${formatMoney(
              w.betAmount,
              configReply.globalSettings
            )}, Win: ${formatMoney(w.winAmount, configReply.globalSettings)})`
          })
        )

        const losersDisplay = await Promise.all(
          losers.map(async (l) => {
            const member = await interaction.guild?.members
              .fetch(l.userId)
              .catch(() => null)
            const username = member ? `<@${member.id}>` : 'Unknown'
            return `${username} (Bet: ${formatMoney(l.betAmount, configReply.globalSettings)}, Win: ${formatMoney(0, configReply.globalSettings)})`
          })
        )

        const embed = new EmbedBuilder()
          .setTitle(`Prediction Payout - ${prediction.title}`)
          .setColor(casinoProfit >= 0 ? Colors.Green : Colors.Red)
          .addFields(
            {
              name: 'Participants',
              value: `${payoutSummary.participants}`,
              inline: true
            },
            { name: 'Winners', value: `${winners.length}`, inline: true },
            { name: 'Losers', value: `${losers.length}`, inline: true },
            {
              name: 'Casino Profit/Loss',
              value: `${formatMoney(casinoProfit, configReply.globalSettings)}`,
              inline: true
            },
            {
              name: 'Winners Detail',
              value: winnersDisplay.join('\n') || 'None'
            },
            {
              name: 'Losers Detail',
              value: losersDisplay.join('\n') || 'None'
            }
          )

        logChannel.send({ embeds: [embed] }).catch((err) => {
          logger.error(
            { err, predictionId, guildId: interaction.guildId },
            'Failed to send prediction payout log message'
          )
        })
      }

      const channel = await interaction.client.channels.fetch(
        prediction.channelId
      )
      if (channel?.isTextBased()) {
        const message = await channel.messages.fetch(prediction.predictionId)
        if (message) {
          const embed = message.embeds[0]?.toJSON() || {}
          const editedEmbed = {
            ...embed,
            color: Colors.Green,
            title: embed.title
          }
          await message.edit({
            content: `**Status:** Paid (Winner: ${winnerChoice})`,
            embeds: [editedEmbed],
            components: []
          })
        }
      }

      logger.event(
        {
          action: 'prediction_payout',
          actorId: interaction.user.id,
          predictionId,
          winnerChoice,
          guildId: interaction.guildId,
          winnerCount: winner.bets.length
        },
        'Admin paid prediction winners'
      )

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Winners Paid',
            `All users who bet on **${winnerChoice}** have been paid.`
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (subcommand === 'cancel') {
      const predictionId = options.getString('prediction-id', true)

      const updatedPrediction = await cancelPrediction({
        predictionId,
        guildId: interaction.guildId!
      })

      if (!updatedPrediction) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Prediction Not Active or Not Found',
              `Prediction **${predictionId}** is either already canceled or does not exist.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const allBets = updatedPrediction.choices.flatMap((c) => c.bets)

      const channel = await interaction.client.channels.fetch(
        updatedPrediction.channelId
      )
      if (channel?.isTextBased()) {
        try {
          const message = await channel.messages.fetch(
            updatedPrediction.predictionId
          )
          if (!message) return

          const embed = message.embeds[0]?.toJSON() || {}
          const editedEmbed = {
            ...embed,
            color: Colors.Red,
            title: embed.title
          }

          await message.edit({
            content: '**Status:** Canceled — All bets refunded',
            embeds: [editedEmbed],
            components: []
          })
        } catch {}
      }

      logger.event(
        {
          action: 'prediction_cancel',
          actorId: interaction.user.id,
          predictionId,
          guildId: interaction.guildId,
          title: updatedPrediction.title,
          refundedBets: allBets.length
        },
        'Admin canceled prediction and refunded bets'
      )

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Prediction Canceled',
            `All bets for **${updatedPrediction.title}** have been refunded.`
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (subcommand === 'check') {
      const predictionId = options.getString('prediction-id', true)
      const prediction = await getPredictionById({
        predictionId,
        guildId: interaction.guildId!
      })

      if (!prediction) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Prediction Not Found',
              `No prediction found with ID: ${predictionId}`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const checkSummary = getPredictionCheckSummary(prediction)
      const totalBetAmount = checkSummary.totalBetAmount

      const choiceSummaries = await Promise.all(
        checkSummary.choices.map(async (choice) => {
          const bettors = await Promise.all(
            choice.bets.map(async (b) => {
              const member = await interaction.guild?.members
                .fetch(b.userId)
                .catch(() => null)
              const username = member ? `<@${member.id}>` : 'Unknown'
              return `${username} — Bet: ${formatMoney(b.amount, configReply.globalSettings)}`
            })
          )

          return {
            name: `Option: ${choice.choiceName} (${choice.odds}x)`,
            value:
              `Bets: ${bettors.length}\n` +
              `Total Bet: ${formatMoney(
                choice.totalBetAmount,
                configReply.globalSettings
              )}\n` +
              `If Wins → Payout: ${formatMoney(choice.payoutIfWins, configReply.globalSettings)}\n` +
              (bettors.length ? bettors.join('\n') : 'No bets'),
            inline: false
          }
        })
      )

      const embed = new EmbedBuilder()
        .setTitle(`Prediction Status - ${prediction.title}`)
        .setColor(Colors.Blurple)
        .addFields(
          { name: 'Status', value: prediction.status, inline: true },
          {
            name: 'Total Bets',
            value: `${formatMoney(totalBetAmount, configReply.globalSettings)}`,
            inline: true
          },
          ...choiceSummaries
        )
        .setFooter({ text: `ID: ${prediction.predictionId}` })
        .setTimestamp()

      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
      })
    }
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}

export const autocomplete: AutocompleteCommand = async ({ interaction }) => {
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
