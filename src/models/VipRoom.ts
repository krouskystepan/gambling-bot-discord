import { VipRoomSchema, TVipRoom } from 'gambling-bot-shared'
import { model } from 'mongoose'

VipRoomSchema.index({ expiresAt: 1 })
VipRoomSchema.index({ userId: 1, guildId: 1 }, { unique: true })

export default model<TVipRoom>('VipRoom', VipRoomSchema)
