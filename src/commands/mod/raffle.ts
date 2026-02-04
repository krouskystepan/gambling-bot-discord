import { DateTime } from 'luxon'

import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  CommandInteractionOptionResolver,
  EmbedBuilder,
  Message,
  MessageFlags
} from 'discord.js'

import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  checkRaffleChannels,
  createTransaction,
  updateUserBalance
} from '@/services'
import {
  deleteRaffle,
  getRaffleById,
  upsertRaffle
} from '@/services/db/raffle.db'
import {
  formatNumberToReadableString,
  generateBetId,
  parseReadableStringToNumber,
  parseTimeToSeconds
} from '@/utils/common/utils'
import {
  createErrorEmbed,
  createInfoEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'

export const data: CommandData = {
  name: 'raffle',
  description: 'Manage global ticket raffles.',
  options: [
    {
      name: 'create',
      description: 'Create a new scheduled raffle.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'ticket-price',
          description: 'Price per ticket. (e.g., 1000, 2k, 4.5k)',
          type: ApplicationCommandOptionType.String,
          required: true
        },
        {
          name: 'max-tickets',
          description: 'Maximum tickets a user can buy.',
          type: ApplicationCommandOptionType.Integer,
          required: true
        },
        {
          name: 'draw-time',
          description: 'Draw date (DD.MM.YYYY HH:mm).',
          type: ApplicationCommandOptionType.String,
          required: true
        },
        {
          name: 'interval',
          description: 'How often the raffle repeats (e.g. 10m, 2h, 1d, 1w)',
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
    },
    {
      name: 'cancel',
      description: 'Cancel raffle and refund all tickets.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'raffle-id',
          description: 'ID of the raffle.',
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true
        }
      ]
    },
    {
      name: 'check',
      description: 'Check how many tickets each user has bought in a raffle.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'raffle-id',
          description: 'ID of the raffle.',
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true
        }
      ]
    }
  ],
  dm_permission: false
}

export const options: CommandOptions = {
  botPermissions: ['Administrator'],
  deleted: false
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    const configReply = await checkRaffleChannels(interaction)
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
            }.`
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const opts = interaction.options as CommandInteractionOptionResolver
    const sub = opts.getSubcommand()

    if (sub === 'create') {
      const ticketPriceInput = opts.getString('ticket-price', true)
      const parsedTicketPrice = parseReadableStringToNumber(ticketPriceInput)

      if (!parsedTicketPrice || parsedTicketPrice <= 0) {
        return interaction.reply({
          embeds: [
            createErrorEmbed('Invalid Ticket Price', 'Enter a valid number.')
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const readableTicketPrice =
        formatNumberToReadableString(parsedTicketPrice)

      const maxTickets = opts.getInteger('max-tickets', true)
      const drawInput = opts.getString('draw-time', true)
      const intervalInput = opts.getString('interval', true)

      const intervalSeconds = parseTimeToSeconds(intervalInput)
      if (intervalSeconds <= 0) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid Interval',
              'Use formats like **10m, 2h, 1d, 1w**.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const intervalMs = intervalSeconds * 1000

      const dateTimeRegex = /^(\d{1,2})\.(\d{1,2})\.(\d{4}) (\d{2}):(\d{2})$/
      const match = drawInput.match(dateTimeRegex)

      if (!match) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid Draw Date/Time',
              'Use **DD.MM.YYYY HH:mm** (24h). Example: `09.02.2026 20:00`'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const [_, day, month, year, hour, minute] = match.map(Number)

      const dt = DateTime.fromObject(
        { year, month, day, hour, minute },
        { zone: 'Europe/Prague' }
      )

      if (!dt.isValid || dt.toMillis() <= Date.now()) {
        return interaction.reply({
          embeds: [
            createErrorEmbed('Invalid Draw Time', 'Draw must be in the future.')
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      await interaction.deferReply()
      const messageReply = (await interaction.fetchReply()) as Message

      const betId = generateBetId()

      await upsertRaffle({
        drawId: betId,
        raffleId: messageReply.id,
        creatorId: interaction.user.id,
        guildId: interaction.guildId!,
        channelId: interaction.channelId,
        ticketPrice: parsedTicketPrice,
        maxTicketsPerUser: maxTickets,
        nextDrawAt: dt.toJSDate(),
        drawIntervalMs: intervalMs
      })

      const drawUnix = Math.floor(dt.toSeconds())

      const embed = new EmbedBuilder()
        .setColor(Colors.Gold)
        .setTitle('🎫 Global Raffle')
        .setDescription(
          [
            `💰 Ticket Price: **$${readableTicketPrice}**`,
            `🎟️ Ticket Limit: **${maxTickets}**`,
            '',
            `🗓️ Drawing Date: **<t:${drawUnix}:F>**`,
            '',
            '💸 Current Pot: **$0**'
          ].join('\n')
        )
        .setFooter({ text: `ID: ${betId}` })

      const row = new ActionRowBuilder<ButtonBuilder>()

      const ticketOptions = [1, 5, 10]
      for (const qty of ticketOptions) {
        if (maxTickets >= qty) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`raffle.${messageReply.id}.${qty}`)
              .setLabel(`Buy ${qty} Ticket${qty > 1 ? 's' : ''}`)
              .setEmoji('🎫')
              .setStyle(ButtonStyle.Success)
          )
        }
      }

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      })
    }

    if (sub === 'cancel') {
      const raffleId = opts.getString('raffle-id', true)

      const raffle = await getRaffleById({
        raffleId,
        guildId: interaction.guildId!
      })

      if (!raffle) {
        return interaction.reply({
          embeds: [createErrorEmbed('Not Found', 'Raffle does not exist.')],
          flags: MessageFlags.Ephemeral
        })
      }

      const ticketPrice = raffle.ticketPrice

      for (const entry of raffle.participants) {
        const refundAmount = entry.tickets * ticketPrice

        await createTransaction({
          userId: entry.userId,
          guildId: interaction.guildId!,
          amount: refundAmount,
          type: 'refund',
          source: 'casino',
          betId: raffleId
        })

        await updateUserBalance({
          userId: entry.userId,
          guildId: interaction.guildId!,
          amount: refundAmount
        })
      }

      const raffleMessage = await interaction.channel?.messages
        .fetch(raffleId)
        .catch(() => null)

      if (raffleMessage) {
        const canceledEmbed = new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle('🎫 Global Raffle (Canceled)')
          .setDescription(
            [
              '❌ **This raffle has been canceled**',
              '',
              `💰 Ticket Price: **$${formatNumberToReadableString(ticketPrice)}**`,
              `🎟️ Ticket Limit: **${raffle.maxTicketsPerUser}**`,
              '',
              '💸 All tickets have been refunded.'
            ].join('\n')
          )
          .setFooter({ text: `ID: ${raffleId}` })

        await raffleMessage.edit({
          embeds: [canceledEmbed],
          components: []
        })
      }

      await deleteRaffle({ raffleId })

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Raffle Refunded',
            'Raffle canceled and all tickets refunded.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (sub === 'check') {
      const raffleId = opts.getString('raffle-id', true)

      const raffle = await getRaffleById({
        raffleId,
        guildId: interaction.guildId!
      })

      if (!raffle) {
        return interaction.reply({
          embeds: [createErrorEmbed('Not Found', 'Raffle does not exist.')],
          flags: MessageFlags.Ephemeral
        })
      }

      if (!raffle.participants.length) {
        return interaction.reply({
          embeds: [
            createInfoEmbed('No Tickets', 'No one has bought tickets yet.')
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const lines = raffle.participants
        .filter((p) => p.tickets > 0)
        .map((p) => `<@${p.userId}> — Tickets bought: **${p.tickets}**`)

      const embed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setTitle('🎫 Raffle Ticket Overview')
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Raffle ID: ${raffleId}` })

      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
      })
    }
  } catch (err) {
    await handleUnexpectedInteractionError(interaction, err)
  }
}
