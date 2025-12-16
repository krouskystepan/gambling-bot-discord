import { TVipRoom } from 'gambling-bot-shared'

import VipRoom from '../../models/VipRoom'
import { TCreateVip, TGetVip } from '../../types/types'

export const getActiveVipByOwner = async ({ guildId, ownerId }: TGetVip) => {
  const vipInfo = await VipRoom.findOne({
    guildId,
    ownerId,
    expiresAt: { $gt: new Date() }
  }).lean<TVipRoom>()

  return vipInfo
}

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
    { new: true }
  )
}
