import {
  defaultCasinoSettings,
  normalizeCasinoSettings
} from 'gambling-bot-shared/casino'
import { describe, expect, it } from 'vitest'

describe('normalizeCasinoSettings', () => {
  it('fills missing winAnnouncements from defaults', () => {
    const { winAnnouncements: _ignored, ...withoutWinAnnouncements } =
      defaultCasinoSettings

    const normalized = normalizeCasinoSettings(withoutWinAnnouncements)

    expect(normalized.winAnnouncements).toEqual(
      defaultCasinoSettings.winAnnouncements
    )
  })
})
