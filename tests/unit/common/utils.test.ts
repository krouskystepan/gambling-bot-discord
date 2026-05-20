import { describe, expect, it } from 'vitest'

import {
  formatNumberToReadableString,
  parseReadableStringToNumber,
  parseTimeToSeconds
} from '@/utils/common/utils'

describe('parseReadableStringToNumber', () => {
  it('parses k suffix', () => {
    expect(parseReadableStringToNumber('2k')).toBe(2000)
  })

  it('parses M suffix', () => {
    expect(parseReadableStringToNumber('4.5M')).toBe(4_500_000)
  })

  it('parses B suffix', () => {
    expect(parseReadableStringToNumber('1B')).toBe(1_000_000_000)
  })

  it('returns NaN for invalid input', () => {
    expect(parseReadableStringToNumber('not-a-bet')).toBeNaN()
  })
})

describe('formatNumberToReadableString', () => {
  it('formats thousands', () => {
    expect(formatNumberToReadableString(2500)).toBe('2.5k')
  })

  it('formats millions', () => {
    expect(formatNumberToReadableString(4_500_000)).toBe('4.5M')
  })

  it('formats negative values', () => {
    expect(formatNumberToReadableString(-1000)).toBe('-1k')
  })
})

describe('parseTimeToSeconds', () => {
  it('parses combined units', () => {
    expect(parseTimeToSeconds('1d2h')).toBe(86400 + 7200)
  })

  it('parses minutes', () => {
    expect(parseTimeToSeconds('30m')).toBe(1800)
  })

  it('returns 0 for empty input', () => {
    expect(parseTimeToSeconds('')).toBe(0)
  })
})
