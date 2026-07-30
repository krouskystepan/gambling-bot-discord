import { AsyncLocalStorage } from 'node:async_hooks'

import { MessageFlags } from 'discord.js'

import type { createSuccessEmbed } from '@/utils/discord/createEmbed'

export type QuestNotifyInteraction = {
  followUp: (options: {
    embeds: ReturnType<typeof createSuccessEmbed>[]
    flags: typeof MessageFlags.Ephemeral
  }) => Promise<unknown>
  deferred?: boolean
  replied?: boolean
}

type QuestNotifyStore = {
  interaction: QuestNotifyInteraction
}

const questNotifyStorage = new AsyncLocalStorage<QuestNotifyStore>()

export const getQuestNotifyInteraction = (): QuestNotifyInteraction | null =>
  questNotifyStorage.getStore()?.interaction ?? null

/** Bind quest completion follow-ups to this interaction for the async call tree. */
export const runWithQuestNotifyInteraction = <T>(
  interaction: QuestNotifyInteraction,
  fn: () => Promise<T>
): Promise<T> => questNotifyStorage.run({ interaction }, fn)
