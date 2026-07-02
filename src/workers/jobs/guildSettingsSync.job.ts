import { normalizeBonusSettings } from 'gambling-bot-shared/bonus'
import { normalizeCasinoSettings } from 'gambling-bot-shared/casino'
import {
  type TGuildConfiguration,
  normalizeGlobalSettings
} from 'gambling-bot-shared/guild'
import type { HydratedDocument } from 'mongoose'

import { isDeepStrictEqual } from 'node:util'

import { Client } from 'commandkit'

import GuildConfiguration from '@/models/GuildConfiguration'
import { createGuildConfiguration } from '@/services'
import { logger } from '@/utils/logger'

type SettingsSectionKey = 'casinoSettings' | 'globalSettings' | 'bonusSettings'

const toComparable = (value: unknown): unknown => {
  if (
    typeof value === 'object' &&
    value !== null &&
    'toObject' in value &&
    typeof value.toObject === 'function'
  ) {
    return value.toObject()
  }

  return value
}

const SETTINGS_SECTIONS: Array<{
  key: SettingsSectionKey
  normalize: (value: unknown) => unknown
}> = [
  {
    key: 'casinoSettings',
    normalize: (value) =>
      normalizeCasinoSettings(
        value as Parameters<typeof normalizeCasinoSettings>[0]
      )
  },
  {
    key: 'globalSettings',
    normalize: (value) =>
      normalizeGlobalSettings(
        value as Parameters<typeof normalizeGlobalSettings>[0]
      )
  },
  {
    key: 'bonusSettings',
    normalize: (value) =>
      normalizeBonusSettings(
        value as Parameters<typeof normalizeBonusSettings>[0]
      )
  }
]

const applyNormalizedSection = (
  doc: HydratedDocument<TGuildConfiguration>,
  key: SettingsSectionKey,
  normalize: (value: unknown) => unknown
): boolean => {
  const current = doc[key]
  const merged = normalize(current)
  if (!isDeepStrictEqual(toComparable(current), merged)) {
    switch (key) {
      case 'casinoSettings':
        doc.casinoSettings = merged as TGuildConfiguration['casinoSettings']
        break
      case 'globalSettings':
        doc.globalSettings = merged as TGuildConfiguration['globalSettings']
        break
      case 'bonusSettings':
        doc.bonusSettings = merged as TGuildConfiguration['bonusSettings']
        break
    }
    return true
  }
  return false
}

export const mergeGuildSettingsSections = (
  doc: HydratedDocument<TGuildConfiguration>
): string[] => {
  const changed: string[] = []

  for (const { key, normalize } of SETTINGS_SECTIONS) {
    if (applyNormalizedSection(doc, key, normalize)) {
      changed.push(key)
    }
  }

  return changed
}

export const guildSettingsSyncJob = async (client: Client<true>) => {
  for (const guild of client.guilds.cache.values()) {
    try {
      const dbSettings = await GuildConfiguration.findOne({ guildId: guild.id })

      if (!dbSettings) {
        await createGuildConfiguration({ guildId: guild.id })
        logger.worker(`🆕 Created settings => ${guild.name} (${guild.id})`)
        continue
      }

      const changed = mergeGuildSettingsSections(dbSettings)

      if (changed.length > 0) {
        await dbSettings.save()
        logger.worker(
          `🔧 Updated settings (${changed.join(', ')}) => ${guild.name} (${guild.id})`
        )
      }
    } catch (err) {
      logger.error(`Guild settings sync failed for guild ${guild.id}`, err)
    }
  }
}
