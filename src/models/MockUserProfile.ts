import mongoose, { Schema } from 'mongoose'

/**
 * Dev-only synthetic Discord identity for Admin UI.
 * Lives outside gambling-bot-shared - never published as production user schema.
 */
export type TMockUserProfile = {
  guildId: string
  userId: string
  username: string
  nickname: string | null
  avatarUrl: string
  createdAt: Date
  updatedAt: Date
}

const MockUserProfileSchema = new Schema<TMockUserProfile>(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    username: { type: String, required: true },
    nickname: { type: String, default: null },
    avatarUrl: { type: String, required: true }
  },
  { timestamps: true, collection: 'mock_user_profiles' }
)

MockUserProfileSchema.index({ guildId: 1, userId: 1 }, { unique: true })

export default (mongoose.models
  .MockUserProfile as mongoose.Model<TMockUserProfile>) ||
  mongoose.model<TMockUserProfile>('MockUserProfile', MockUserProfileSchema)
