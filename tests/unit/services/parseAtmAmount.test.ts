import { describe, expect, it } from 'vitest'

import { parseAtmAmount } from '@/services/atm/parseAtmAmount'

describe('parseAtmAmount', () => {
  it('returns an error embed when the amount is not a number', () => {
    const result = parseAtmAmount('not-a-number')

    expect(result).toEqual({
      ok: false,
      embed: {
        data: expect.objectContaining({
          title: 'Invalid Input - Not a number',
          description:
            'The value you entered is not a valid number.\nPlease make sure you enter a numerical value.'
        })
      }
    })
  })

  it('returns an error embed when the amount is not positive', () => {
    const result = parseAtmAmount('0')

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.embed.data.title).toBe('Invalid Input - Non-positive number')
    expect(result.embed.data.description).toBe(
      'The number you provided must be greater than 0.\nPlease enter a positive value.'
    )
  })

  it('returns the parsed amount for a valid positive number', () => {
    expect(parseAtmAmount('2.5k')).toEqual({ ok: true, amount: 2500 })
  })
})
