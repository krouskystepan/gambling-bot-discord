import { parseReadableStringToNumber } from 'gambling-bot-shared/common'

import { EmbedBuilder } from 'discord.js'

import { createErrorEmbed } from '@/utils/discord/createEmbed'

import {
  ATM_AMOUNT_NON_POSITIVE_DESCRIPTION,
  ATM_AMOUNT_NON_POSITIVE_TITLE,
  ATM_AMOUNT_NOT_A_NUMBER_DESCRIPTION,
  ATM_AMOUNT_NOT_A_NUMBER_TITLE
} from './atmRequestCopy'

export type ParseAtmAmountResult =
  | { ok: true; amount: number }
  | { ok: false; embed: EmbedBuilder }

export const parseAtmAmount = (amount: string): ParseAtmAmountResult => {
  const parsedAmount = parseReadableStringToNumber(amount)

  if (isNaN(parsedAmount)) {
    return {
      ok: false,
      embed: createErrorEmbed(
        ATM_AMOUNT_NOT_A_NUMBER_TITLE,
        ATM_AMOUNT_NOT_A_NUMBER_DESCRIPTION
      )
    }
  }

  if (parsedAmount <= 0) {
    return {
      ok: false,
      embed: createErrorEmbed(
        ATM_AMOUNT_NON_POSITIVE_TITLE,
        ATM_AMOUNT_NON_POSITIVE_DESCRIPTION
      )
    }
  }

  return { ok: true, amount: parsedAmount }
}
