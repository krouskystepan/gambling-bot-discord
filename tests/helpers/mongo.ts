import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach } from 'vitest'

import '@/models/Transaction'
import '@/models/User'
import '@/models/Prediction'
import '@/models/VipRoom'
import '@/models/Raffle'

import Transaction from '@/models/Transaction'
import User from '@/models/User'
import Prediction from '@/models/Prediction'
import VipRoom from '@/models/VipRoom'
import Raffle from '@/models/Raffle'

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
  dailyStreak = 0
}: {
  userId?: string
  guildId?: string
  balance?: number
  bonusBalance?: number
  lockedBalance?: number
  lastDailyClaim?: Date | null
  dailyStreak?: number
} = {}) => {
  return User.create({
    userId,
    guildId,
    balance,
    bonusBalance,
    lockedBalance,
    lastDailyClaim,
    dailyStreak
  })
}

export { Transaction, User, Prediction, VipRoom, Raffle }
