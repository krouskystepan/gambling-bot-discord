import { TVipRoom } from 'gambling-bot-shared'
// NEW

import mongoose from 'mongoose'

import GuildConfiguration from '@/models/GuildConfiguration'
import Transaction from '@/models/Transaction'
import User from '@/models/User'

import VipRoom from '../../models/VipRoom'
import { TCreateVip, TGetVip } from '../../types/types'

export const getAllActiveVipsByGuildId = async ({
  guildId
}: {
  guildId: string
}) => {
  const vipInfos = await VipRoom.find({
    guildId,
    expiresAt: { $gt: new Date() }
  }).lean<TVipRoom[]>()

  return vipInfos
}

export const getAllActiveVips = async () => {
  const vipInfos = await VipRoom.find({
    expiresAt: { $gt: new Date() }
  })

  return vipInfos
}

export const getAllOldVips = async () => {
  const vipInfos = await VipRoom.find({
    expiresAt: { $lt: new Date() }
  })

  return vipInfos
}

export const createVip = async ({
  ownerId,
  guildId,
  channelId,
  expiresAt
}: TCreateVip) => {
  await VipRoom.create({
    ownerId,
    guildId,
    channelId,
    expiresAt
  })
}

export const deleteVipByOwnerId = async ({
  ownerId,
  guildId
}: {
  ownerId: string
  guildId: string
}) => {
  await VipRoom.findOneAndDelete({ ownerId, guildId })
}

export const extendVipExpiry = async ({
  ownerId,
  guildId,
  newExpiry
}: {
  ownerId: string
  guildId: string
  newExpiry: Date
}) => {
  const updatedVip = await VipRoom.findOneAndUpdate(
    { ownerId, guildId },
    { $set: { expiresAt: newExpiry } }
  )

  return updatedVip
}

export const addMemberToVip = async ({
  ownerId,
  guildId,
  memberId
}: {
  ownerId: string
  guildId: string
  memberId: string
}) => {
  await VipRoom.findOneAndUpdate(
    { ownerId, guildId },
    { $addToSet: { memberIds: memberId } }
  )
}

export const removeMemberFromVip = async ({
  ownerId,
  guildId,
  memberId
}: {
  ownerId: string
  guildId: string
  memberId: string
}) => {
  return VipRoom.findOneAndUpdate(
    { ownerId, guildId },
    { $pull: { memberIds: memberId } },
    { returnDocument: 'after' }
  )
}

// NEW
export const getActiveVipByOwner = async ({ guildId, ownerId }: TGetVip) => {
  const vipInfo = await VipRoom.findOne({
    guildId,
    ownerId,
    expiresAt: { $gt: new Date() }
  }).lean<TVipRoom>()

  return vipInfo
}

export async function reserveVipPurchase({
  userId,
  guildId,
  totalPrice
}: {
  userId: string
  guildId: string
  totalPrice: number
}) {
  const session = await mongoose.startSession()

  try {
    await session.withTransaction(async () => {
      const existingVip = await VipRoom.findOne({
        ownerId: userId,
        guildId,
        expiresAt: { $gt: new Date() }
      }).session(session)

      if (existingVip) throw new Error('VIP_ALREADY_EXISTS')

      const res = await User.updateOne(
        { userId, guildId, balance: { $gte: totalPrice } },
        { $inc: { balance: -totalPrice } },
        { session }
      )

      if (res.modifiedCount === 0) throw new Error('INSUFFICIENT_FUNDS')
    })
  } finally {
    session.endSession()
  }
}

export async function finalizeVipPurchase({
  ownerId,
  guildId,
  channelId,
  expiresAt,
  purchaseId
}: {
  ownerId: string
  guildId: string
  channelId: string
  expiresAt: Date
  purchaseId: string
}) {
  await VipRoom.create({
    ownerId,
    guildId,
    channelId,
    expiresAt
  })

  await Transaction.create({
    userId: ownerId,
    guildId,
    amount: 0,
    type: 'vip',
    source: 'system',
    meta: { action: 'buy-finalize', purchaseId, channelId }
  })
}

export async function refundVipPurchase({
  userId,
  guildId,
  totalPrice,
  purchaseId
}: {
  userId: string
  guildId: string
  totalPrice: number
  purchaseId: string
}) {
  await User.updateOne({ userId, guildId }, { $inc: { balance: totalPrice } })

  await Transaction.create({
    userId,
    guildId,
    amount: totalPrice,
    type: 'vip',
    source: 'system',
    meta: { action: 'buy-refund', purchaseId }
  })
}

export async function extendVipAtomic({
  userId,
  guildId,
  totalPrice,
  newExpiry,
  durationDays
}: {
  userId: string
  guildId: string
  totalPrice: number
  newExpiry: Date
  durationDays: number
}) {
  const session = await mongoose.startSession()

  try {
    await session.withTransaction(async () => {
      const user = await User.findOne({ userId, guildId }).session(session)
      if (!user) throw new Error('USER_NOT_FOUND')

      if (user.balance < totalPrice) {
        throw new Error('INSUFFICIENT_FUNDS')
      }

      const vip = await VipRoom.findOne({
        ownerId: userId,
        guildId,
        expiresAt: { $gt: new Date() }
      }).session(session)
      if (!vip) throw new Error('VIP_NOT_FOUND')

      user.balance -= totalPrice
      vip.expiresAt = newExpiry

      await user.save({ session })
      await vip.save({ session })

      await Transaction.create(
        [
          {
            userId,
            guildId,
            amount: totalPrice,
            type: 'vip',
            source: 'system',
            meta: {
              action: 'extend',
              durationDays
            }
          }
        ],
        { session }
      )
    })
  } finally {
    session.endSession()
  }
}

export async function addVipMemberAtomic({
  ownerId,
  guildId,
  memberId
}: {
  ownerId: string
  guildId: string
  memberId: string
}): Promise<number> {
  const session = await mongoose.startSession()

  try {
    let priceCharged = 0

    await session.withTransaction(async () => {
      const vip = await VipRoom.findOne({ ownerId, guildId }).session(session)
      if (!vip) throw new Error('VIP_NOT_FOUND')

      const guildSettings = await GuildConfiguration.findOne({
        guildId
      }).session(session)
      if (!guildSettings) throw new Error('VIP_SETTINGS_NOT_FOUND')

      const { maxMembers, pricePerAdditionalMember } = guildSettings.vipSettings

      if (vip.memberIds.includes(memberId)) throw new Error('ALREADY_MEMBER')

      if (vip.memberIds.length >= maxMembers) throw new Error('VIP_FULL')

      const balanceUpdate = await User.updateOne(
        {
          userId: ownerId,
          guildId,
          balance: { $gte: pricePerAdditionalMember }
        },
        { $inc: { balance: -pricePerAdditionalMember } },
        { session }
      )

      if (balanceUpdate.modifiedCount === 0)
        throw new Error('INSUFFICIENT_FUNDS')

      await VipRoom.updateOne(
        { ownerId, guildId },
        { $addToSet: { memberIds: memberId } },
        { session }
      )

      await Transaction.create(
        [
          {
            userId: ownerId,
            guildId,
            amount: pricePerAdditionalMember,
            type: 'vip',
            source: 'system',
            meta: { action: 'add-member', addedUserId: memberId }
          }
        ],
        { session }
      )

      priceCharged = pricePerAdditionalMember
    })

    return priceCharged
  } finally {
    session.endSession()
  }
}

export async function removeVipMemberAtomic({
  ownerId,
  guildId,
  memberId
}: {
  ownerId: string
  guildId: string
  memberId: string
}) {
  const session = await mongoose.startSession()

  try {
    await session.withTransaction(async () => {
      const vip = await VipRoom.findOne({ ownerId, guildId }).session(session)
      if (!vip) throw new Error('VIP_NOT_FOUND')

      if (!vip.memberIds.includes(memberId)) throw new Error('NOT_A_MEMBER')

      await VipRoom.updateOne(
        { ownerId, guildId },
        { $pull: { memberIds: memberId } },
        { session }
      )

      await Transaction.create(
        [
          {
            userId: ownerId,
            guildId,
            amount: 0,
            type: 'vip',
            source: 'system',
            meta: { action: 'remove-member', removedUserId: memberId }
          }
        ],
        { session }
      )
    })
  } finally {
    session.endSession()
  }
}
