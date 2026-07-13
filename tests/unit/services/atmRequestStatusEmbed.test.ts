import { Colors } from 'discord.js'
import { describe, expect, it } from 'vitest'

import { buildAtmRequestStatusEmbed } from '@/services/atm/atmRequestStatusEmbed'

const baseRequest = {
  requestId: 'req-1',
  amount: 1000,
  account: 'PayPal',
  createdAt: new Date('2026-06-15T12:30:00Z')
}

describe('buildAtmRequestStatusEmbed', () => {
  it('builds pending withdrawal embed with review copy', () => {
    const embed = buildAtmRequestStatusEmbed({
      ...baseRequest,
      type: 'withdraw',
      status: 'pending'
    })

    expect(embed.data.title).toBe('ATM - Withdrawal Status')
    expect(embed.data.color).toBe(Colors.Blue)
    expect(embed.data.description).toBe('Awaiting manager review.')
    expect(embed.data.fields?.map((field) => field.name)).toEqual([
      'Status',
      'Amount',
      'Account',
      'Request ID',
      'Submitted'
    ])
    expect(embed.data.fields?.[0]?.value).toBe('Pending')
    expect(embed.data.fields?.[3]?.value).toBe('req-1')
  })

  it('builds approved deposit embed with processed timestamp', () => {
    const handledAt = new Date('2026-06-16T10:00:00Z')
    const embed = buildAtmRequestStatusEmbed({
      ...baseRequest,
      type: 'deposit',
      status: 'approved',
      handledAt
    })

    expect(embed.data.title).toBe('ATM - Deposit Status')
    expect(embed.data.color).toBe(Colors.Green)
    expect(embed.data.fields?.map((field) => field.name)).toContain('Processed')
    expect(embed.data.fields?.find((field) => field.name === 'Processed')?.value).toBe(
      `<t:${Math.floor(handledAt.getTime() / 1000)}:F>`
    )
  })

  it('includes rejection notes when present', () => {
    const embed = buildAtmRequestStatusEmbed({
      ...baseRequest,
      type: 'withdraw',
      status: 'rejected',
      handledAt: new Date('2026-06-16T10:00:00Z'),
      notes: 'Invalid account details'
    })

    expect(embed.data.color).toBe(Colors.Red)
    expect(embed.data.fields?.find((field) => field.name === 'Notes')?.value).toBe(
      'Invalid account details'
    )
  })

  it('builds cancelled deposit embed with player-cancel copy', () => {
    const handledAt = new Date('2026-06-16T10:00:00Z')
    const embed = buildAtmRequestStatusEmbed({
      ...baseRequest,
      type: 'deposit',
      status: 'cancelled',
      handledAt,
      meta: { source: 'player-cancel' }
    })

    expect(embed.data.color).toBe(Colors.Grey)
    expect(embed.data.description).toBe('Cancelled by you.')
    expect(embed.data.fields?.[0]?.value).toBe('Cancelled')
    expect(embed.data.fields?.map((field) => field.name)).toContain('Processed')
    expect(
      embed.data.fields?.find((field) => field.name === 'Notes')
    ).toBeUndefined()
  })

  it('builds cancelled embed without player description when cancelled by staff', () => {
    const embed = buildAtmRequestStatusEmbed({
      ...baseRequest,
      type: 'withdraw',
      status: 'cancelled',
      handledBy: 'mod-1',
      handledAt: new Date('2026-06-16T10:00:00Z')
    })

    expect(embed.data.description).toBeUndefined()
    expect(embed.data.fields?.[0]?.value).toBe('Cancelled')
  })

  it('builds cancelled embed from meta source alone', () => {
    const embed = buildAtmRequestStatusEmbed({
      ...baseRequest,
      type: 'withdraw',
      status: 'cancelled',
      meta: { source: 'player-cancel' }
    })

    expect(embed.data.description).toBe('Cancelled by you.')
  })
})
