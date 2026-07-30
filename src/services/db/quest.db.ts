import type { TQuest, TUserQuestProgress } from 'gambling-bot-shared/quests'

import Quest from '@/models/Quest'
import UserQuestProgress from '@/models/UserQuestProgress'

export const getEnabledQuestsForGuild = async (
  guildId: string
): Promise<TQuest[]> =>
  (await Quest.find({ guildId, enabled: true })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean()) as TQuest[]

export const getUserQuestProgressForDay = async ({
  guildId,
  userId,
  dateKey
}: {
  guildId: string
  userId: string
  dateKey: string
}): Promise<TUserQuestProgress[]> =>
  (await UserQuestProgress.find({
    guildId,
    userId,
    $or: [{ dateKey }, { dateKey: null }]
  }).lean()) as TUserQuestProgress[]
