import {
  USER_BANNED_ERROR,
  USER_BANNED_MESSAGE
} from 'gambling-bot-shared/user'

import { createErrorEmbed } from './createEmbed'

export function isUserBannedError(error: unknown): boolean {
  return error instanceof Error && error.message === USER_BANNED_ERROR
}

export function createUserBannedEmbed() {
  return createErrorEmbed('Account Restricted', USER_BANNED_MESSAGE)
}
