import { BONUS_MAX_AMOUNT } from 'gambling-bot-shared/bonus'
import { normalizeCasinoSettings } from 'gambling-bot-shared/casino'
import {
  defaultGlobalSettings,
  normalizeGlobalSettings
} from 'gambling-bot-shared/guild'
import { describe, expect, it } from 'vitest'

import { createGuildConfiguration } from '@/services/db/guildConfiguration.db'
import { mergeGuildSettingsSections } from '@/workers/guildSettingsSync.job'

import { GuildConfiguration, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

const syncGuildConfig = async (guildId: string) => {
  await createGuildConfiguration({ guildId })

  const doc = await GuildConfiguration.findOne({ guildId })
  expect(doc).toBeTruthy()

  const changed = mergeGuildSettingsSections(doc!)
  if (changed.length > 0) {
    await doc!.save()
  }

  return GuildConfiguration.findOne({ guildId })
}

describe('mergeGuildSettingsSections', () => {
  it('normalizes casino drift', async () => {
    const partialCasino = { dice: { minBet: 5 } }

    await syncGuildConfig('guild-casino')
    await GuildConfiguration.collection.updateOne(
      { guildId: 'guild-casino' },
      { $set: { casinoSettings: partialCasino } }
    )

    const doc = await GuildConfiguration.findOne({ guildId: 'guild-casino' })
    expect(doc).toBeTruthy()

    const changed = mergeGuildSettingsSections(doc!)
    expect(changed).toEqual(['casinoSettings'])
    expect(doc!.casinoSettings).toEqual(
      normalizeCasinoSettings(
        partialCasino as Parameters<typeof normalizeCasinoSettings>[0]
      )
    )

    await doc!.save()

    const reloaded = await GuildConfiguration.findOne({
      guildId: 'guild-casino'
    }).lean()
    expect(reloaded?.casinoSettings).toEqual(
      normalizeCasinoSettings(
        partialCasino as Parameters<typeof normalizeCasinoSettings>[0]
      )
    )
  })

  it('normalizes global drift from raw DB values', async () => {
    await syncGuildConfig('guild-global')
    await GuildConfiguration.collection.updateOne(
      { guildId: 'guild-global' },
      {
        $set: {
          globalSettings: {
            disableDeposits: 'true',
            timezone: 'Invalid/Zone'
          }
        }
      }
    )

    const doc = await GuildConfiguration.findOne({ guildId: 'guild-global' })
    expect(doc).toBeTruthy()

    const changed = mergeGuildSettingsSections(doc!)
    expect(changed).toEqual(['globalSettings'])
    expect(doc!.globalSettings).toEqual(
      normalizeGlobalSettings({
        disableDeposits: 'true',
        timezone: 'Invalid/Zone'
      } as unknown as Parameters<typeof normalizeGlobalSettings>[0])
    )
    expect(doc!.globalSettings?.disableDeposits).toBe(true)
    expect(doc!.globalSettings?.timezone).toBe(defaultGlobalSettings.timezone)

    await doc!.save()

    const reloaded = await GuildConfiguration.findOne({
      guildId: 'guild-global'
    }).lean()
    expect(reloaded?.globalSettings?.disableDeposits).toBe(true)
    expect(reloaded?.globalSettings?.timezone).toBe(defaultGlobalSettings.timezone)
  })

  it('clamps bonus drift above caps', async () => {
    await syncGuildConfig('guild-bonus')
    await GuildConfiguration.collection.updateOne(
      { guildId: 'guild-bonus' },
      { $set: { 'bonusSettings.baseReward': 99_999_999 } }
    )

    const doc = await GuildConfiguration.findOne({ guildId: 'guild-bonus' })
    expect(doc).toBeTruthy()

    const changed = mergeGuildSettingsSections(doc!)
    expect(changed).toEqual(['bonusSettings'])
    expect(doc!.bonusSettings.baseReward).toBe(BONUS_MAX_AMOUNT)

    await doc!.save()

    const reloaded = await GuildConfiguration.findOne({
      guildId: 'guild-bonus'
    }).lean()
    expect(reloaded?.bonusSettings.baseReward).toBe(BONUS_MAX_AMOUNT)
  })

  it('returns no changes for fully normalized config', async () => {
    const doc = await syncGuildConfig('guild-noop')
    expect(doc).toBeTruthy()

    const before = doc!.toObject()
    const changed = mergeGuildSettingsSections(doc!)

    expect(changed).toEqual([])
    expect(doc!.toObject()).toEqual(before)
  })

  it('batches casino and global drift into one in-memory update', async () => {
    await syncGuildConfig('guild-batched')
    await GuildConfiguration.collection.updateOne(
      { guildId: 'guild-batched' },
      {
        $set: {
          casinoSettings: {},
          globalSettings: {
            disableDeposits: 'true',
            timezone: 'Invalid/Zone'
          }
        }
      }
    )

    const doc = await GuildConfiguration.findOne({ guildId: 'guild-batched' })
    expect(doc).toBeTruthy()

    const changed = mergeGuildSettingsSections(doc!)
    expect(changed).toEqual(['casinoSettings', 'globalSettings'])

    await doc!.save()

    const reloaded = await GuildConfiguration.findOne({
      guildId: 'guild-batched'
    }).lean()
    expect(reloaded?.casinoSettings).toEqual(normalizeCasinoSettings({}))
    expect(reloaded?.globalSettings?.disableDeposits).toBe(true)
    expect(reloaded?.globalSettings?.timezone).toBe(defaultGlobalSettings.timezone)
  })
})
