import { TVipRoom, VipRoomSchema } from 'gambling-bot-shared'
import mongoose from 'mongoose'

export default (mongoose.models.VipRoom as mongoose.Model<TVipRoom>) ||
  mongoose.model<TVipRoom>('VipRoom', VipRoomSchema)
