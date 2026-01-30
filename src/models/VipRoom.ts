import { TVipRoom } from 'gambling-bot-shared'
import { VipRoomSchema } from 'gambling-bot-shared/server'
import mongoose from 'mongoose'

export default (mongoose.models.VipRoom as mongoose.Model<TVipRoom>) ||
  mongoose.model<TVipRoom>('VipRoom', VipRoomSchema)
