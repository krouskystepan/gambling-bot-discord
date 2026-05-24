import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  formatDate,
  formatNumberToPercentage,
  formatNumberToReadableString,
  formatNumberWithSpaces,
  generateId,
  parseReadableStringToNumber,
  parseTimeToSeconds,
  sleep
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

  it('parses plain numbers without suffix', () => {
    expect(parseReadableStringToNumber('250')).toBe(250)
  })
})

describe('formatNumberToReadableString', () => {
  it('formats thousands', () => {
    expect(formatNumberToReadableString(2500)).toBe('2.5k')
  })

  it('formats millions', () => {
    expect(formatNumberToReadableString(4_500_000)).toBe('4.5M')
  })

  it('formats billions', () => {
    expect(formatNumberToReadableString(2_500_000_000)).toBe('2.5B')
  })

  it('formats small numbers without suffix', () => {
    expect(formatNumberToReadableString(42)).toBe('42')
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

  it('parses weeks', () => {
    expect(parseTimeToSeconds('1w')).toBe(604_800)
  })
})

describe('formatNumberWithSpaces', () => {
  it('groups thousands with spaces', () => {
    expect(formatNumberWithSpaces(1234567)).toBe('1 234 567')
  })
})

describe('formatNumberToPercentage', () => {
  it('formats ratio as percent string', () => {
    expect(formatNumberToPercentage(0.125)).toBe('12.50%')
  })
})

describe('formatDate', () => {
  it('formats UTC date in Europe/Prague zone', () => {
    const formatted = formatDate(new Date('2026-06-15T10:30:00Z'))
    expect(formatted).toMatch(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/)
  })
})

describe('generateId', () => {
  it('returns uppercase alphanumeric id', () => {
    const id = generateId()
    expect(id).toMatch(/^[0-9A-Z]+$/)
    expect(id.length).toBeGreaterThan(5)
  })
})

describe('sleep', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('resolves after delay', async () => {
    const promise = sleep(1000)
    vi.advanceTimersByTime(1000)
    await expect(promise).resolves.toBeUndefined()
  })
})
