import { formatNumberToReadableString } from 'gambling-bot-shared/common'

import AtmRequest from '@/models/AtmRequest'
import BlackjackGame from '@/models/BlackjackGame'
import Prediction from '@/models/Prediction'
import Raffle from '@/models/Raffle'
import Transaction from '@/models/Transaction'
import User from '@/models/User'
import VipRoom from '@/models/VipRoom'

import type { MockDbEntity } from './index'

export type ClearMockDbEntity = MockDbEntity

export type ClearMockDbSummary = {
  entity: ClearMockDbEntity
  deleted: Record<string, number>
}

type ClearTarget = {
  key: string
  label: string
  run: () => Promise<number>
}

async function countDeleted(result: {
  deletedCount?: number
}): Promise<number> {
  return result.deletedCount ?? 0
}

function buildClearTargets(
  guildId: string,
  entity: ClearMockDbEntity
): ClearTarget[] {
  const all = entity === 'all'

  const targets: ClearTarget[] = []

  if (all || entity === 'transactions') {
    targets.push({
      key: 'transactions',
      label: 'Transactions',
      run: async () => countDeleted(await Transaction.deleteMany({ guildId }))
    })
  }

  if (all || entity === 'atm') {
    targets.push({
      key: 'atmRequests',
      label: 'ATM requests',
      run: async () => countDeleted(await AtmRequest.deleteMany({ guildId }))
    })
  }

  if (all || entity === 'raffles') {
    targets.push({
      key: 'raffles',
      label: 'Raffles',
      run: async () => countDeleted(await Raffle.deleteMany({ guildId }))
    })
  }

  if (all || entity === 'predictions') {
    targets.push({
      key: 'predictions',
      label: 'Predictions',
      run: async () => countDeleted(await Prediction.deleteMany({ guildId }))
    })
  }

  if (all || entity === 'vip') {
    targets.push({
      key: 'vipRooms',
      label: 'VIP rooms',
      run: async () => countDeleted(await VipRoom.deleteMany({ guildId }))
    })
  }

  if (all) {
    targets.push({
      key: 'blackjackGames',
      label: 'Blackjack games',
      run: async () => countDeleted(await BlackjackGame.deleteMany({ guildId }))
    })
  }

  if (all || entity === 'users') {
    targets.push({
      key: 'users',
      label: 'Users',
      run: async () => countDeleted(await User.deleteMany({ guildId }))
    })
  }

  return targets
}

export async function runClearMockDb({
  guildId,
  entity
}: {
  guildId: string
  entity: ClearMockDbEntity
}): Promise<ClearMockDbSummary> {
  const targets = buildClearTargets(guildId, entity)
  const deleted: Record<string, number> = {}

  for (const target of targets) {
    deleted[target.key] = await target.run()
  }

  return { entity, deleted }
}

export function formatClearMockDbSummary(summary: ClearMockDbSummary): string {
  const labels: Record<string, string> = {
    transactions: 'Transactions',
    atmRequests: 'ATM requests',
    raffles: 'Raffles',
    predictions: 'Predictions',
    vipRooms: 'VIP rooms',
    blackjackGames: 'Blackjack games',
    users: 'Users'
  }

  const lines = Object.entries(summary.deleted)
    .filter(([, count]) => count > 0)
    .map(
      ([key, count]) =>
        `• **${labels[key] ?? key}**: ${formatNumberToReadableString(count)} removed`
    )

  if (lines.length === 0) {
    return 'Nothing to remove — guild mock data was already empty.'
  }

  return lines.join('\n')
}
