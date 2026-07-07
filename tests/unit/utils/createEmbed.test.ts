import { Colors } from 'discord.js'
import { describe, expect, it } from 'vitest'

import {
  createErrorEmbed,
  createInfoEmbed,
  createSuccessEmbed,
  createWarningEmbed
} from '@/utils/discord/createEmbed'

describe('createEmbed factories', () => {
  it('createSuccessEmbed uses green', () => {
    const embed = createSuccessEmbed('Success', 'Done')
    expect(embed.data.color).toBe(Colors.Green)
  })

  it('createInfoEmbed uses blue', () => {
    const embed = createInfoEmbed('Info', 'Status')
    expect(embed.data.color).toBe(Colors.Blue)
  })

  it('createWarningEmbed uses yellow', () => {
    const embed = createWarningEmbed('Warning', 'Heads up')
    expect(embed.data.color).toBe(Colors.Yellow)
  })

  it('createWarningEmbed sets footer when id is provided', () => {
    const embed = createWarningEmbed('Warning', 'Heads up', 'bet-1')
    expect(embed.data.footer?.text).toBe('ID: bet-1')
  })

  it('createErrorEmbed uses red', () => {
    const embed = createErrorEmbed('Error', 'Blocked')
    expect(embed.data.color).toBe(Colors.Red)
  })
})
