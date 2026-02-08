import { TUser } from 'gambling-bot-shared'
import type { UpdateQuery } from 'mongoose'

import User from '@/models/User'
import { TCreateUser, TGetUser } from '@/types/types'

export const getUser = async ({
  userId,
  guildId
}: TGetUser): Promise<TUser | null> => {
  const user = await User.findOne({ userId, guildId })

  return user
}

export const resetUserBalance = async ({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}): Promise<TUser | null> => {
  const updatedUser = await User.findOneAndUpdate(
    { userId, guildId },
    { $set: { balance: 0, lockedBalance: 0 } },
    { new: true }
  )

  return updatedUser
}

export const forceCreateUser = async ({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}): Promise<TUser | null> => {
  try {
    const user = await User.create({
      userId,
      guildId
    })

    return user
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    ) {
      return null
    }

    throw error
  }
}

export const forceDeleteUser = async ({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}): Promise<TUser | null> => {
  const user = await User.findOne({ userId, guildId })
  if (!user) return null

  await User.deleteOne({ userId, guildId })
  return user
}

// NEW

export const createUserIfNotExists = async ({
  userId,
  guildId
}: TCreateUser): Promise<boolean> => {
  const result = await User.updateOne(
    { userId, guildId },
    {
      $setOnInsert: {
        userId,
        guildId,
        balance: 0,
        lockedBalance: 0
      }
    },
    { upsert: true }
  )

  return result.upsertedCount > 0
}

type PreviewWithdrawResult =
  | { ok: true }
  | { ok: false; reason: 'INSUFFICIENT_BALANCE'; balance: number }
  | {
      ok: false
      reason: 'INSUFFICIENT_WITHDRAWABLE'
      withdrawable: number
      locked: number
    }
  | { ok: false; reason: 'NO_USER' }

export const previewWithdraw = async ({
  userId,
  guildId,
  amount
}: {
  userId: string
  guildId: string
  amount: number
}): Promise<PreviewWithdrawResult> => {
  const user = await getUser({ userId, guildId })
  if (!user) return { ok: false, reason: 'NO_USER' }

  const withdrawable = user.balance - user.lockedBalance

  if (user.balance < amount) {
    return {
      ok: false,
      reason: 'INSUFFICIENT_BALANCE',
      balance: user.balance
    }
  }

  if (withdrawable < amount) {
    return {
      ok: false,
      reason: 'INSUFFICIENT_WITHDRAWABLE',
      withdrawable,
      locked: user.lockedBalance
    }
  }

  return { ok: true }
}

type TUpdateUserBalanceAtomic = {
  userId: string
  guildId: string
  balanceDelta?: number
  lockedDelta?: number
  requireAvailableGte?: number
}

export const updateUserBalanceAtomic = async ({
  userId,
  guildId,
  balanceDelta = 0,
  lockedDelta = 0,
  requireAvailableGte
}: TUpdateUserBalanceAtomic): Promise<TUser | null> => {
  const query: Record<string, unknown> = { userId, guildId }

  query.$expr = {
    $and: [
      { $gte: [{ $add: ['$balance', balanceDelta] }, 0] },
      { $gte: [{ $add: ['$lockedBalance', lockedDelta] }, 0] },
      {
        $lte: [
          { $add: ['$lockedBalance', lockedDelta] },
          { $add: ['$balance', balanceDelta] }
        ]
      },
      ...(requireAvailableGte !== undefined
        ? [
            {
              $gte: [
                {
                  $subtract: [
                    { $add: ['$balance', balanceDelta] },
                    { $add: ['$lockedBalance', lockedDelta] }
                  ]
                },
                requireAvailableGte
              ]
            }
          ]
        : [])
    ]
  }

  const update: UpdateQuery<TUser> = {
    $inc: {
      balance: balanceDelta,
      lockedBalance: lockedDelta
    }
  }

  return User.findOneAndUpdate(query, update, { new: true })
}
