import { DateTime } from 'luxon'

import { AutocompleteCommand } from 'commandkit'

import { searchRafflesForAutocomplete } from '@/services/db/raffle.db'
import { formatNumberToReadableString } from '@/utils/common/utils'

const formatDate = (date: Date) =>
  DateTime.fromJSDate(date, { zone: 'utc' })
    .setZone('Europe/Prague')
    .toFormat('dd.LL.yyyy HH:mm')

const autocomplete: AutocompleteCommand = async ({ interaction }) => {
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
      name: `TP: ${formatNumberToReadableString(r.ticketPrice)} • TL: ${r.maxTicketsPerUser} • ND: ${formatDate(r.nextDrawAt)} | CP: ${r.totalPot}`,
      value: r.raffleId
    }))
  )
}

export default autocomplete
