import { formatMoney, formatMoneyExact } from 'gambling-bot-shared/common'
import {
  defaultGlobalSettings,
  isGlobalFeatureDisabled,
  normalizeGlobalSettings
} from 'gambling-bot-shared/guild'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'
import { describe, expect, it } from 'vitest'

const baseConfig = (globalSettings?: TGuildConfiguration['globalSettings']) =>
  ({
    guildId: 'g1',
    atmChannelIds: { actions: '', logs: '' },
    casinoChannelIds: [],
    winAnnouncementsChannelId: '',
    predictionChannelIds: { actions: '', logs: '' },
    raffleChannelIds: { actions: '', logs: '' },
    managerRoleId: '',
    casinoSettings: {} as TGuildConfiguration['casinoSettings'],
    vipSettings: {
      roleOwnerId: '',
      roleMemberId: '',
      categoryId: '',
      pricePerDay: 0,
      pricePerCreate: 0,
      pricePerAdditionalMember: 0,
      maxMembers: 2
    },
    bonusSettings: {
      rewardMode: 'linear',
      baseReward: 0,
      maxReward: 0,
      resetOnMax: false,
      milestoneBonus: { weekly: 0, monthly: 0 }
    },
    globalSettings
  }) as TGuildConfiguration

describe('normalizeGlobalSettings', () => {
  it('returns defaults for empty input', () => {
    expect(normalizeGlobalSettings(undefined)).toEqual(defaultGlobalSettings)
  })

  it('clamps invalid timezone and currency fields', () => {
    expect(
      normalizeGlobalSettings({
        timezone: 'Invalid/Zone',
        currencySymbol: ''
      })
    ).toMatchObject({
      timezone: 'UTC',
      currencySymbol: '$'
    })
  })

  it('keeps valid regional overrides', () => {
    expect(
      normalizeGlobalSettings({
        timezone: 'Europe/Prague',
        currencySymbol: 'Kč',
        currencyPlacement: 'suffix'
      })
    ).toMatchObject({
      timezone: 'Europe/Prague',
      currencySymbol: 'Kč',
      currencyPlacement: 'suffix'
    })
  })

  it('preserves spacing in currency symbol', () => {
    expect(
      normalizeGlobalSettings({
        currencySymbol: '$ ',
        currencyPlacement: 'prefix'
      })
    ).toMatchObject({ currencySymbol: '$ ' })
    expect(
      normalizeGlobalSettings({
        currencySymbol: ' CZK',
        currencyPlacement: 'suffix'
      })
    ).toMatchObject({ currencySymbol: ' CZK' })
  })

  it('defaults invalid currency placement to prefix', () => {
    expect(
      normalizeGlobalSettings({ currencyPlacement: 'after' as 'prefix' })
    ).toMatchObject({ currencyPlacement: 'prefix' })
  })
})

describe('formatMoney', () => {
  const usdPrefix = {
    currencySymbol: '$',
    currencyPlacement: 'prefix' as const
  }

  const czkSuffix = {
    currencySymbol: 'CZK',
    currencyPlacement: 'suffix' as const
  }

  it('formats prefix without automatic spacing', () => {
    expect(formatMoney(1500, usdPrefix)).toBe('$1.5k')
    expect(formatMoneyExact(1500, usdPrefix)).toBe('$1 500')
  })

  it('formats suffix without automatic spacing', () => {
    expect(formatMoney(1500, czkSuffix)).toBe('1.5kCZK')
    expect(formatMoneyExact(1500, czkSuffix)).toBe('1 500CZK')
  })

  it('uses spacing from currencySymbol when provided', () => {
    expect(
      formatMoney(1500, { currencySymbol: '$ ', currencyPlacement: 'prefix' })
    ).toBe('$ 1.5k')
    expect(
      formatMoney(1500, { currencySymbol: ' CZK', currencyPlacement: 'suffix' })
    ).toBe('1.5k CZK')
  })

  it('places negative sign before the full amount', () => {
    expect(formatMoney(-1500, usdPrefix)).toBe('-$1.5k')
    expect(formatMoney(-1500, czkSuffix)).toBe('-1.5kCZK')
  })
})

describe('isGlobalFeatureDisabled', () => {
  it('treats missing config and globalSettings as enabled', () => {
    expect(isGlobalFeatureDisabled(null, 'deposit')).toBe(false)
    expect(isGlobalFeatureDisabled(baseConfig(), 'deposit')).toBe(false)
  })

  it('maps each disable flag', () => {
    const config = baseConfig({
      ...defaultGlobalSettings,
      disableDeposits: true,
      disableCasinoGamesForMods: true,
      maintenanceMode: true
    })
    expect(isGlobalFeatureDisabled(config, 'deposit')).toBe(true)
    expect(isGlobalFeatureDisabled(config, 'casinoGamesForMods')).toBe(true)
    expect(isGlobalFeatureDisabled(config, 'maintenance')).toBe(true)
    expect(isGlobalFeatureDisabled(config, 'registration')).toBe(false)
  })
})
