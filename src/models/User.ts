import { TUser, UserSchema } from 'gambling-bot-shared'
import { model } from 'mongoose'

export default model<TUser>('User', UserSchema)
