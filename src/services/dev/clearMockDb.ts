import {
  type GuildDataWipeModels,
  type GuildWipeEntity,
  formatGuildDataWipeSummary,
  runGuildDataWipe
} from 'gambling-bot-shared/dev'

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

const WIPE_MODELS: GuildDataWipeModels = {
  transactions: Transaction,
  atmRequests: AtmRequest,
  raffles: Raffle,
  predictions: Prediction,
  vipRooms: VipRoom,
  blackjackGames: BlackjackGame,
  users: User
}

export async function runClearMockDb({
  guildId,
  entity
}: {
  guildId: string
  entity: ClearMockDbEntity
}): Promise<ClearMockDbSummary> {
  const summary = await runGuildDataWipe({
    guildId,
    entities: [entity as GuildWipeEntity],
    models: WIPE_MODELS
  })

  return {
    entity,
    deleted: summary.deleted
  }
}

export function formatClearMockDbSummary(summary: ClearMockDbSummary): string {
  return formatGuildDataWipeSummary({
    entities: [summary.entity as GuildWipeEntity],
    deleted: summary.deleted
  })
}
