import { TAtmRequest } from 'gambling-bot-shared/atm'
import { formatMoney } from 'gambling-bot-shared/common'
import { type GlobalSettings } from 'gambling-bot-shared/guild'

import { Colors, EmbedBuilder } from 'discord.js'

const STATUS_COLORS = {
  pending: Colors.Blue,
  approved: Colors.Green,
  rejected: Colors.Red
} as const

const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected'
} as const

export const buildAtmRequestStatusEmbed = (
  request: Pick<
    TAtmRequest,
    | 'requestId'
    | 'type'
    | 'amount'
    | 'account'
    | 'status'
    | 'createdAt'
    | 'handledAt'
    | 'notes'
  >,
  globalSettings?: Partial<GlobalSettings> | null
) => {
  const title =
    request.type === 'withdraw'
      ? 'ATM - Withdrawal Status'
      : 'ATM - Deposit Status'
  const submittedUnix = Math.floor(request.createdAt.getTime() / 1000)

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(STATUS_COLORS[request.status])
    .addFields(
      { name: 'Status', value: STATUS_LABELS[request.status], inline: true },
      {
        name: 'Amount',
        value: formatMoney(request.amount, globalSettings),
        inline: true
      },
      { name: 'Account', value: request.account, inline: false },
      { name: 'Request ID', value: request.requestId, inline: false },
      {
        name: 'Submitted',
        value: `<t:${submittedUnix}:F>`,
        inline: true
      }
    )

  if (request.status === 'pending') {
    embed.setDescription('Awaiting manager review.')
  }

  if (request.status !== 'pending' && request.handledAt) {
    embed.addFields({
      name: 'Processed',
      value: `<t:${Math.floor(request.handledAt.getTime() / 1000)}:F>`,
      inline: true
    })
  }

  if (request.status === 'rejected' && request.notes) {
    embed.addFields({ name: 'Notes', value: request.notes, inline: false })
  }

  return embed
}
