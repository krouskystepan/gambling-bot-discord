import {
  USER_BANNED_ERROR,
  USER_BANNED_MESSAGE
} from 'gambling-bot-shared/user'
import { describe, expect, it, vi } from 'vitest'

import {
  createUserBannedEmbed,
  isUserBannedError
} from '@/utils/discord/userBannedError'

vi.mock('@/utils/discord/createEmbed', () => ({
  createErrorEmbed: (title: string, description: string) => ({
    title,
    description
  })
}))

describe('isUserBannedError', () => {
  it('returns true for USER_BANNED errors', () => {
    expect(isUserBannedError(new Error(USER_BANNED_ERROR))).toBe(true)
  })

  it('returns false for other errors and non-errors', () => {
    expect(isUserBannedError(new Error('OTHER'))).toBe(false)
    expect(isUserBannedError('USER_BANNED')).toBe(false)
    expect(isUserBannedError(null)).toBe(false)
  })
})

describe('createUserBannedEmbed', () => {
  it('builds the restricted account embed', () => {
    expect(createUserBannedEmbed()).toEqual({
      title: 'Account Restricted',
      description: USER_BANNED_MESSAGE
    })
  })
})
