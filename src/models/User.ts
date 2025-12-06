import { TUser, UserSchema } from 'gambling-bot-shared'
import { model } from 'mongoose'

UserSchema.index({ userId: 1, guildId: 1 }, { unique: true })

export default model<TUser>('User', UserSchema)
