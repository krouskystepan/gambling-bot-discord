import { TVipRoom, VipRoomSchema } from 'gambling-bot-shared'
import { model } from 'mongoose'

export default model<TVipRoom>('VipRoom', VipRoomSchema)
