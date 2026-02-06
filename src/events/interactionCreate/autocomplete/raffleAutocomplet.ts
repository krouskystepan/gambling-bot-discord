import { DateTime } from 'luxon'

import { AutocompleteInteraction, Client } from 'discord.js'

import { searchRafflesForAutocomplete } from '@/services/db/raffle.db'
import { formatNumberToReadableString } from '@/utils/common/utils'

const formatDate = (date: Date) =>
  DateTime.fromJSDate(date, { zone: 'utc' })
    .setZone('Europe/Prague')
    .toFormat('dd.LL.yyyy HH:mm')

export default async (
  interaction: AutocompleteInteraction,
  _client: Client
) => {
  if (!interaction.isAutocomplete()) return
  if (interaction.commandName !== 'raffle') return

  const subcommand = interaction.options.getSubcommand()
  const focused = interaction.options.getFocused().toLowerCase()

  if (subcommand !== 'cancel' && subcommand !== 'check') return

  const raffles = await searchRafflesForAutocomplete({
    guildId: interaction.guildId!,
    query: focused
  })

  if (raffles.length === 0) {
    return interaction.respond([{ name: 'No raffles found', value: 'none' }])
  }

  return interaction.respond(
    raffles.map((r) => ({
      name: `ID: ${r.raffleId} • Ticket Price: ${formatNumberToReadableString(r.ticketPrice)} • Next Draw: ${formatDate(r.nextDrawAt)}`,
      value: r.raffleId
    }))
  )
}
