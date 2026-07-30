import { formatMoney } from 'gambling-bot-shared/common'
import {
  type TGuildConfiguration,
  isGlobalFeatureDisabled
} from 'gambling-bot-shared/guild'
import {
  type EvaluateAndGrantQuestsResult,
  evaluateAndGrantQuests
} from 'gambling-bot-shared/quests'

import { MessageFlags } from 'discord.js'

import Quest from '@/models/Quest'
import Transaction from '@/models/Transaction'
import User from '@/models/User'
import UserQuestProgress from '@/models/UserQuestProgress'
import { createSuccessEmbed } from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

import {
  type QuestNotifyInteraction,
  getQuestNotifyInteraction
} from './questNotifyContext'

export type { QuestNotifyInteraction }

export const runQuestEvaluation = async ({
  guildId,
  userId,
  guildConfig
}: {
  guildId: string
  userId: string
  guildConfig?: TGuildConfiguration | null
}): Promise<EvaluateAndGrantQuestsResult> => {
  const disableQuests =
    !!guildConfig && isGlobalFeatureDisabled(guildConfig, 'quests')

  return evaluateAndGrantQuests({
    guildId,
    userId,
    models: {
      questModel: Quest,
      progressModel: UserQuestProgress,
      userModel: User,
      transactionModel: Transaction
    },
    timezone: guildConfig?.globalSettings?.timezone,
    disableQuests
  })
}

const canFollowUp = (interaction: QuestNotifyInteraction): boolean =>
  Boolean(interaction.deferred || interaction.replied)

/** Fire-and-forget evaluate; optionally notify via interaction followUp. */
export const tryEvaluateQuests = ({
  guildId,
  userId,
  guildConfig,
  interaction
}: {
  guildId: string
  userId: string
  guildConfig?: TGuildConfiguration | null
  interaction?: QuestNotifyInteraction | null
}): void => {
  const notifyInteraction = interaction ?? getQuestNotifyInteraction()

  void runQuestEvaluation({ guildId, userId, guildConfig })
    .then((result) => {
      if (!notifyInteraction) return
      if (!result.completed.length) return
      if (!canFollowUp(notifyInteraction)) return

      const globalSettings = guildConfig?.globalSettings
      const lines = result.completed.map(
        (grant) =>
          `✅ **${grant.quest.name}** - +${formatMoney(grant.rewardAmount, globalSettings)} bonus`
      )

      void notifyInteraction
        .followUp({
          embeds: [createSuccessEmbed('Quest Complete', lines.join('\n'))],
          flags: MessageFlags.Ephemeral
        })
        .catch((error) => {
          logger.error(
            { error, guildId, userId },
            'Failed to send quest completion follow-up'
          )
        })
    })
    .catch((error) => {
      logger.error({ error, guildId, userId }, 'Quest evaluation failed')
    })
}
