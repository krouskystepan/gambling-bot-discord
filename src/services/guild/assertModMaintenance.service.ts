import { TGuildConfiguration } from 'gambling-bot-shared/guild'

import {
  RepliableInteractionLike,
  assertNotMaintenance
} from './checkGlobalFeature.service'
import { getGuildConfigByGuildId } from './guildConfiguration.db'

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
