import { TAtmRequest } from 'gambling-bot-shared/atm'

import { ColorResolvable } from 'discord.js'

type AtmRequestType = TAtmRequest['type']

export const ATM_AMOUNT_NOT_A_NUMBER_TITLE = 'Invalid Input - Not a number'
export const ATM_AMOUNT_NOT_A_NUMBER_DESCRIPTION =
  'The value you entered is not a valid number.\nPlease make sure you enter a numerical value.'

export const ATM_AMOUNT_NON_POSITIVE_TITLE =
  'Invalid Input - Non-positive number'
export const ATM_AMOUNT_NON_POSITIVE_DESCRIPTION =
  'The number you provided must be greater than 0.\nPlease enter a positive value.'

export const ATM_LOG_CHANNEL_MISCONFIGURED_TITLE = 'Wrong Discord Configuration'
export const ATM_LOG_CHANNEL_MISCONFIGURED_DESCRIPTION =
  'Log channel misconfigured or inaccessible.'

const ATM_REQUEST_COPY = {
  deposit: {
    staffTitle: (displayName: string, username: string) =>
      `ATM - Deposit by ${displayName} (${username})`,
    staffColor: 'Green' as ColorResolvable,
    staffDescription: (
      userId: string,
      readableAmount: string,
      account: string
    ) =>
      `<@${userId}> requested a deposit of **${readableAmount}** from account **${account}**.`,
    playerTitle: 'ATM - Deposit',
    playerDescription: (readableAmount: string) =>
      `You have successfully deposited **${readableAmount}** to your account.\nPlease wait for the transaction to be processed.\n\nCheck status with \`/deposit status\` or cancel a pending request with \`/deposit cancel\`.`,
    loggerAction: 'atm_deposit_requested' as const,
    loggerMessage: 'ATM deposit request created'
  },
  withdraw: {
    staffTitle: (displayName: string, username: string) =>
      `ATM - Withdrawal by ${displayName} (${username})`,
    staffColor: 'Red' as ColorResolvable,
    staffDescription: (
      userId: string,
      readableAmount: string,
      account: string
    ) =>
      `<@${userId}> requested a withdrawal of **${readableAmount}** to account **${account}**.`,
    playerTitle: 'ATM - Withdraw',
    playerDescription: (readableAmount: string) =>
      `You have requested to withdraw **${readableAmount}**.\nPlease wait for the transaction to be processed.\n\nCheck status with \`/withdraw status\` or cancel a pending request with \`/withdraw cancel\`.`,
    loggerAction: 'atm_withdraw_requested' as const,
    loggerMessage: 'ATM withdrawal request created'
  }
} satisfies Record<
  AtmRequestType,
  {
    staffTitle: (displayName: string, username: string) => string
    staffColor: ColorResolvable
    staffDescription: (
      userId: string,
      readableAmount: string,
      account: string
    ) => string
    playerTitle: string
    playerDescription: (readableAmount: string) => string
    loggerAction: string
    loggerMessage: string
  }
>

export const getAtmRequestCopy = (type: AtmRequestType) =>
  ATM_REQUEST_COPY[type]
