import { TGuildConfiguration } from 'gambling-bot-shared'

import { getGuildConfigByGuildId } from '../db/guildConfiguration.db'
import {
  RepliableInteractionLike,
  assertNotMaintenance
} from './checkGlobalFeature.service'

/** Blocks mod/setup commands during maintenance unless the user is a server admin. */
export const assertModMaintenanceAllowed = async (
  interaction: RepliableInteractionLike,
  guildId: string
): Promise<TGuildConfiguration | null | false> => {
  const config = await getGuildConfigByGuildId({ guildId })
  if (!config) return null
  if (!(await assertNotMaintenance(interaction, config))) return false
  return config
}
