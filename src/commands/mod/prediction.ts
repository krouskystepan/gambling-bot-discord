import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'
import {
  CommandInteractionOptionResolver,
  ApplicationCommandOptionType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  EmbedBuilder,
  Colors,
  Message,
  TextChannel,
} from 'discord.js'
import Prediction, { PredictionOption } from '../../models/Prediction'
import { createErrorEmbed, createSuccessEmbed } from '../../utils/createEmbed'
import User from '../../models/User'
import {
  checkChannelConfiguration,
  formatNumberToReadableString,
} from '../../utils/utils'
import { DateTime } from 'luxon'

export const data: CommandData = {
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
          required: true,
        },
        {
          name: 'choices',
          description:
            'Comma-separated list of choices with odds (e.g. Yes:2,No:1.5,Maybe:3)',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: 'autolock',
          description:
            'Optional: Automatically lock this prediction at a specific date & time (DD-MM-YYYY HH:mm)',
          type: ApplicationCommandOptionType.String,
          required: false,
        },
      ],
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
          required: true,
        },
      ],
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
          autocomplete: true,
        },
        {
          name: 'winner',
          description: 'Name of the winning choice (full name)',
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
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
          autocomplete: true,
        },
      ],
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
          autocomplete: true,
        },
      ],
    },
  ],
  dm_permission: false,
}

export const options: CommandOptions = {
  botPermissions: ['Administrator'],
  deleted: false,
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    const configReply = await checkChannelConfiguration(
      interaction,
      'predictionChannelIds',
      {
        notSet:
          'This server has not been configured for predictions yet.\nSet it up using web dashboard.',
        notAllowed: `This channel is not configured for prediction command.\nTry one of these channels:`,
      }
    )

    if (!configReply) return

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
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const options = interaction.options as CommandInteractionOptionResolver
    const subcommand = options.getSubcommand()

    if (subcommand === 'create') {
      const title = options.getString('title', true)
      const choicesInput = options.getString('choices', true)
      const autolockInput = options.getString('autolock', false)

      const rawChoices = choicesInput.split(',').map((c) => c.trim())
      if (rawChoices.length < 2 || rawChoices.length > 3) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid Input - Wrong Number of Choices',
              'You must provide **2 or 3 choices** only.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const choicesArray: PredictionOption[] = []
      for (const item of rawChoices) {
        const [name, odds] = item.split(':').map((x) => x.trim())
        if (!name || !odds || isNaN(Number(odds))) {
          return interaction.reply({
            embeds: [
              createErrorEmbed(
                'Invalid Input - Invalid Format',
                `Invalid option format: "${item}". Use OptionName:Odds (e.g. Yes:2)`
              ),
            ],
            flags: MessageFlags.Ephemeral,
          })
        }
        choicesArray.push({
          choiceName: name,
          odds: Number(odds),
          bets: [],
        })
      }

      let autolockDate: Date | null = null
      if (autolockInput) {
        const dateTimeRegex = /^(\d{1,2})\.(\d{1,2})\.(\d{4}) (\d{2}):(\d{2})$/
        const match = autolockInput.match(dateTimeRegex)

        if (!match) {
          return interaction.reply({
            embeds: [
              createErrorEmbed(
                'Invalid Input - Invalid Autolock Date/Time',
                'Autolock must be in **D.M.YYYY HH:mm** or **DD.MM.YYYY HH:mm** format (24h). Example: `9.9.2025 18:00` or `09.09.2025 18:00`'
              ),
            ],
            flags: MessageFlags.Ephemeral,
          })
        }

        const [_, day, month, year, hour, minute] = match.map(Number)

        const dt = DateTime.fromObject(
          { year, month, day, hour, minute },
          //! Later in db
          { zone: 'Europe/Prague' }
        )

        if (!dt.isValid) {
          return interaction.reply({
            embeds: [
              createErrorEmbed(
                'Invalid Input - Invalid Autolock Date/Time',
                'The date/time you provided is invalid.'
              ),
            ],
            flags: MessageFlags.Ephemeral,
          })
        }

        if (dt.toMillis() <= Date.now()) {
          return interaction.reply({
            embeds: [
              createErrorEmbed(
                'Invalid Input - Autolock in the Past',
                'Autolock must be a future date/time. Please provide a date and time that is after now.'
              ),
            ],
            flags: MessageFlags.Ephemeral,
          })
        }

        autolockDate = dt.toJSDate()
      }

      await interaction.deferReply()
      const messageReply = (await interaction.fetchReply()) as Message

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
        components: [row],
      })

      await Prediction.create({
        predictionId: messageReply.id,
        guildId: interaction.guildId!,
        channelId: interaction.channel?.id,
        creatorId: interaction.user.id,
        title,
        choices: choicesArray,
        autolock: autolockDate,
        status: 'active',
      })
    }

    if (subcommand === 'end') {
      const predictionId = options.getString('prediction-id', true)
      const prediction = await Prediction.findOne({ predictionId })

      if (!prediction) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Prediction Not Found',
              `No prediction found with ID: ${predictionId}`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      if (prediction.status !== 'active') {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Prediction is not active',
              `This prediction is already ${prediction.status}.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      prediction.status = 'ended'
      await prediction.save()

      const channel = await interaction.client.channels.fetch(
        prediction.channelId
      )
      if (!channel || !channel.isTextBased()) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Channel Not Found',
              'Could not fetch the channel for this prediction.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const message = await channel.messages.fetch(prediction.predictionId)
      if (message) {
        const embed = message.embeds[0]?.toJSON() || {}
        const editedEmbed = {
          ...embed,
          color: Colors.Orange,
        }
        await message.edit({
          content: '**Status:** Ended',
          embeds: [editedEmbed],
          components: [],
        })
      }

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Prediction Ended',
            `Prediction **${prediction.title}** has ended.\n` +
              `No more bets can be placed.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (subcommand === 'payout') {
      if (!configReply?.predictionChannelIds.logs) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Logs Not Set Up',
              'Prediction logs are not configured yet.\nPlease complete the setup.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const predictionId = options.getString('prediction-id', true)
      const winnerChoice = options.getString('winner', true)

      const prediction = await Prediction.findOne({ predictionId })
      if (!prediction) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Prediction Not Found',
              `No prediction found with ID: ${predictionId}`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      if (prediction.status !== 'ended') {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Prediction Not Ended',
              `You can only payout a prediction that has ended. Current status: ${prediction.status}`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const winner = prediction.choices.find(
        (c) => c.choiceName === winnerChoice
      )
      if (!winner) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid Choice',
              `The winner "${winnerChoice}" does not exist in this prediction.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      for (const bet of winner.bets) {
        await User.findOneAndUpdate(
          { userId: bet.userId, guildId: interaction.guildId },
          {
            $inc: {
              balance: bet.amount * winner.odds,
              netProfit: bet.amount * winner.odds,
            },
          }
        )
      }

      prediction.status = 'paid'
      await prediction.save()

      const logChannel = interaction.client.channels.cache.get(
        configReply.predictionChannelIds.logs
      ) as TextChannel

      if (!logChannel) {
        console.error('Log channel not found!')
      } else {
        const totalBets = prediction.choices.flatMap((c) => c.bets)

        const winners = winner.bets.map((b) => ({
          userId: b.userId,
          betAmount: b.amount,
          winAmount: b.amount * winner.odds,
        }))

        const losers = prediction.choices
          .filter((c) => c.choiceName !== winnerChoice)
          .flatMap((c) =>
            c.bets.map((b) => ({
              userId: b.userId,
              betAmount: b.amount,
              winAmount: 0,
            }))
          )

        const totalWon = winners.reduce((acc, w) => acc + w.winAmount, 0)
        const totalLost = losers.reduce((acc, l) => acc + l.betAmount, 0)
        const casinoProfit = totalLost - totalWon

        const winnersDisplay = await Promise.all(
          winners.map(async (w) => {
            const member = await interaction.guild?.members
              .fetch(w.userId)
              .catch(() => null)
            const username = member ? `<@${member.id}>` : 'Unknown'
            return `${username} (Bet: $${formatNumberToReadableString(
              w.betAmount
            )}, Win: $${formatNumberToReadableString(w.winAmount)})`
          })
        )

        const losersDisplay = await Promise.all(
          losers.map(async (l) => {
            const member = await interaction.guild?.members
              .fetch(l.userId)
              .catch(() => null)
            const username = member ? `<@${member.id}>` : 'Unknown'
            return `${username} (Bet: $${formatNumberToReadableString(
              l.betAmount
            )}, Win: $0)`
          })
        )

        const embed = new EmbedBuilder()
          .setTitle(`Prediction Payout - ${prediction.title}`)
          .setColor(casinoProfit >= 0 ? Colors.Green : Colors.Red)
          .addFields(
            {
              name: 'Participants',
              value: `${totalBets.length}`,
              inline: true,
            },
            { name: 'Winners', value: `${winners.length}`, inline: true },
            { name: 'Losers', value: `${losers.length}`, inline: true },
            {
              name: 'Casino Profit/Loss',
              value: `$${formatNumberToReadableString(casinoProfit)}`,
              inline: true,
            },
            {
              name: 'Winners Detail',
              value: winnersDisplay.join('\n') || 'None',
            },
            { name: 'Losers Detail', value: losersDisplay.join('\n') || 'None' }
          )

        logChannel.send({ embeds: [embed] }).catch(console.error)
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
            title: embed.title,
          }
          await message.edit({
            content: `**Status:** Paid (Winner: ${winnerChoice})`,
            embeds: [editedEmbed],
            components: [],
          })
        }
      }

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Winners Paid',
            `All users who bet on **${winnerChoice}** have been paid.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (subcommand === 'cancel') {
      const predictionId = options.getString('prediction-id', true)
      const prediction = await Prediction.findOne({
        predictionId,
        status: 'active',
      })

      if (!prediction) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Prediction Not Found',
              `No prediction found with ID: ${predictionId}`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const allBets = prediction.choices.flatMap((c) => c.bets)
      for (const bet of allBets) {
        await User.findOneAndUpdate(
          { userId: bet.userId, guildId: interaction.guildId },
          { $inc: { balance: bet.amount } }
        )
      }

      prediction.status = 'canceled'
      await prediction.save()

      const channel = await interaction.client.channels.fetch(
        prediction.channelId
      )
      if (channel?.isTextBased()) {
        try {
          const message = await channel.messages.fetch(prediction.predictionId)

          if (!message) return

          const embed = message.embeds[0]?.toJSON() || {}
          const editedEmbed = {
            ...embed,
            color: Colors.Red,
            title: `${embed.title}`,
          }

          await message.edit({
            content: '**Status:** Canceled — All bets refunded',
            embeds: [editedEmbed],
            components: [],
          })
        } catch {}
      }

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Prediction Canceled',
            `All bets for **${prediction.title}** have been refunded.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (subcommand === 'check') {
      const predictionId = options.getString('prediction-id', true)
      const prediction = await Prediction.findOne({ predictionId })

      if (!prediction) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Prediction Not Found',
              `No prediction found with ID: ${predictionId}`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const totalBets = prediction.choices.flatMap((c) => c.bets)
      const totalBetAmount = totalBets.reduce((acc, b) => acc + b.amount, 0)

      const choiceSummaries = await Promise.all(
        prediction.choices.map(async (choice) => {
          const totalWin = choice.bets.reduce(
            (acc, b) => acc + b.amount * choice.odds,
            0
          )

          const bettors = await Promise.all(
            choice.bets.map(async (b) => {
              const member = await interaction.guild?.members
                .fetch(b.userId)
                .catch(() => null)
              const username = member ? `<@${member.id}>` : 'Unknown'
              return `${username} — Bet: $${formatNumberToReadableString(
                b.amount
              )}`
            })
          )

          return {
            name: `Option: ${choice.choiceName} (${choice.odds}x)`,
            value:
              `Bets: ${bettors.length}\n` +
              `Total Bet: $${formatNumberToReadableString(
                choice.bets.reduce((a, b) => a + b.amount, 0)
              )}\n` +
              `If Wins → Payout: $${formatNumberToReadableString(totalWin)}\n` +
              (bettors.length ? bettors.join('\n') : 'No bets'),
            inline: false,
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
            value: `$${formatNumberToReadableString(totalBetAmount)}`,
            inline: true,
          },
          ...choiceSummaries
        )
        .setFooter({ text: `ID: ${prediction.predictionId}` })
        .setTimestamp()

      return interaction.reply({
        embeds: [embed],
      })
    }
  } catch (error: any) {
    console.error('Error running the command:', error)
  }
}
