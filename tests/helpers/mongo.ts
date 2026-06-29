import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, beforeAll, beforeEach } from 'vitest'

import '@/models/AtmRequest'
import AtmRequest from '@/models/AtmRequest'
import '@/models/BlackjackGame'
import BlackjackGame from '@/models/BlackjackGame'
import '@/models/GuildConfiguration'
import GuildConfiguration from '@/models/GuildConfiguration'
import '@/models/Prediction'
import Prediction from '@/models/Prediction'
import '@/models/Raffle'
import Raffle from '@/models/Raffle'
import '@/models/Transaction'
import Transaction from '@/models/Transaction'
import '@/models/User'
import User from '@/models/User'
import '@/models/VipRoom'
import VipRoom from '@/models/VipRoom'

let replSet: MongoMemoryReplSet

export const setupMongoTests = () => {
  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' }
    })
    await mongoose.connect(replSet.getUri(), { dbName: 'gambling-bot-test' })
  }, 120_000)

  afterAll(async () => {
    await mongoose.disconnect()
    await replSet?.stop()
  }, 30_000)

  beforeEach(async () => {
    const collections = mongoose.connection.collections
    await Promise.all(
      Object.values(collections).map((collection) => collection.deleteMany({}))
    )
  })
}

export const createTestUser = async ({
  userId = 'user-1',
  guildId = 'guild-1',
  balance = 1000,
  bonusBalance = 0,
  lockedBalance = 0,
  lastDailyClaim = null,
  dailyStreak = 0,
  banned = false
}: {
  userId?: string
  guildId?: string
  balance?: number
  bonusBalance?: number
  lockedBalance?: number
  lastDailyClaim?: Date | null
  dailyStreak?: number
  banned?: boolean
} = {}) => {
  return User.create({
    userId,
    guildId,
    balance,
    bonusBalance,
    lockedBalance,
    lastDailyClaim,
    dailyStreak,
    banned
  })
}

export {
  AtmRequest,
  BlackjackGame,
  GuildConfiguration,
  Transaction,
  User,
  Prediction,
  VipRoom,
  Raffle
}
