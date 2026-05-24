import mongoose from 'mongoose'

import { logger } from '@/utils/logger'

export const connectToDatabase = async () => {
  try {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not defined')
    mongoose.set('strictQuery', false)
    await mongoose.connect(process.env.MONGO_URI)
    logger.boot('✅ Connected to the database')
  } catch (error) {
    logger.error('Error connecting to the database', error)
    process.exit(1)
  }
}
