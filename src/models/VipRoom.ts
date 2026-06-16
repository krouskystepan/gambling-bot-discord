import { VipRoomSchema } from 'gambling-bot-shared/mongoose'
import { TVipRoom } from 'gambling-bot-shared/vip'
import mongoose from 'mongoose'

export default (mongoose.models.VipRoom as mongoose.Model<TVipRoom>) ||
  mongoose.model<TVipRoom>('VipRoom', VipRoomSchema)
