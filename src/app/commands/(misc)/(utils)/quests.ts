import { formatMoney } from 'gambling-bot-shared/common'
import {
  type TQuest,
  getQuestDateKey,
  resolveQuestThreshold
} from 'gambling-bot-shared/quests'

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags
} from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  assertGlobalFeature,
  assertNotMaintenance,
  checkUserRegistration,
  getEnabledQuestsForGuild,
  getGuildConfigByGuildId,
  getUserQuestProgressForDay
} from '@/services'
import { createErrorEmbed, createInfoEmbed } from '@/utils/discord/createEmbed'
import {
  type QuestEmbedPage,
  type QuestViewTab,
  buildQuestEmbedPages,
  formatQuestProgressLine,
  resolveQuestPage
} from '@/utils/discord/formatQuestsEmbed'

export const command: CommandData = {
  name: 'quests',
  description: 'View your daily and normal quest progress.',
  dm_permission: false
}

const QUEST_VIEW_TTL_MS = 120_000

const CUSTOM_ID = {
  overview: 'quests:tab:overview',
  daily: 'quests:tab:daily',
  normal: 'quests:tab:normal',
  prev: 'quests:page:prev',
  next: 'quests:page:next'
} as const

const countDone = (lines: string[]): number =>
  lines.filter((line) => line.startsWith('✅')).length

const buildQuestComponents = ({
  view,
  page
}: {
  view: QuestViewTab
  page: QuestEmbedPage
}) => {
  const tabs = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.overview)
      .setLabel('Overview')
      .setStyle(
        view === 'overview' ? ButtonStyle.Primary : ButtonStyle.Secondary
      ),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.daily)
      .setLabel('Daily')
      .setStyle(view === 'daily' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.normal)
      .setLabel('Normal')
      .setStyle(view === 'normal' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  )

  const rows: ActionRowBuilder<ButtonBuilder>[] = [tabs]

  if (view !== 'overview' && page.pageCount > 1) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(CUSTOM_ID.prev)
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page.pageIndex <= 0),
        new ButtonBuilder()
          .setCustomId(CUSTOM_ID.next)
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page.pageIndex >= page.pageCount - 1)
      )
    )
  }

  return rows
}

const toEmbed = (page: QuestEmbedPage) =>
  createInfoEmbed(page.title, page.description)

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const user = await checkUserRegistration({ interaction, allowBanned: true })
    if (!user) return

    const guildConfig = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })
    if (!guildConfig) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Quests not configured',
            'Quests are not configured for this server.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (!(await assertNotMaintenance(interaction, guildConfig))) return
    if (!(await assertGlobalFeature(interaction, guildConfig, 'quests'))) {
      return
    }

    const guildId = interaction.guildId!
    const userId = user.userId
    const timezone = guildConfig.globalSettings?.timezone
    const dateKey = getQuestDateKey(new Date(), timezone)
    const globalSettings = guildConfig.globalSettings

    const quests = await getEnabledQuestsForGuild(guildId)
    const progressRows = await getUserQuestProgressForDay({
      guildId,
      userId,
      dateKey
    })

    const progressByQuest = new Map(
      progressRows.map((row) => [
        `${row.questId}:${row.dateKey ?? 'null'}`,
        row
      ])
    )

    const dailyQuests = quests.filter((q) => q.kind === 'daily')
    const normalQuests = quests.filter((q) => q.kind === 'normal')

    const toLine = (quest: TQuest): string => {
      const key = `${quest.questId}:${quest.kind === 'daily' ? dateKey : 'null'}`
      const progress = progressByQuest.get(key)
      const threshold = resolveQuestThreshold(quest.condition)
      const current = Math.min(progress?.progress ?? 0, threshold)
      return formatQuestProgressLine({
        done: !!progress?.rewardedAt,
        name: quest.name,
        current,
        threshold,
        reward: formatMoney(quest.rewardAmount, globalSettings)
      })
    }

    const dailyLines = dailyQuests.map(toLine)
    const normalLines = normalQuests.map(toLine)

    const pages = buildQuestEmbedPages({
      dateKey,
      dailyLines,
      normalLines,
      dailyDone: countDone(dailyLines),
      dailyTotal: dailyQuests.length,
      normalDone: countDone(normalLines),
      normalTotal: normalQuests.length
    })

    let view: QuestViewTab = 'overview'
    let pageIndex = 0

    const currentPage = () => resolveQuestPage({ pages, view, pageIndex })

    await interaction.reply({
      embeds: [toEmbed(currentPage())],
      components: buildQuestComponents({
        view,
        page: currentPage()
      }),
      flags: MessageFlags.Ephemeral
    })

    const message = await interaction.fetchReply()

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
      time: QUEST_VIEW_TTL_MS
    })

    collector.on('collect', async (button) => {
      try {
        if (button.customId === CUSTOM_ID.overview) {
          view = 'overview'
          pageIndex = 0
        } else if (button.customId === CUSTOM_ID.daily) {
          view = 'daily'
          pageIndex = 0
        } else if (button.customId === CUSTOM_ID.normal) {
          view = 'normal'
          pageIndex = 0
        } else if (button.customId === CUSTOM_ID.prev && view !== 'overview') {
          pageIndex = Math.max(0, pageIndex - 1)
        } else if (button.customId === CUSTOM_ID.next && view !== 'overview') {
          const pageCount = pages[view].length
          pageIndex = Math.min(pageCount - 1, pageIndex + 1)
        } else {
          await button.deferUpdate()
          return
        }

        const page = currentPage()
        await button.update({
          embeds: [toEmbed(page)],
          components: buildQuestComponents({
            view,
            page
          })
        })
      } catch {
        collector.stop('error')
      }
    })

    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [] })
      } catch {
        // Message may already be gone.
      }
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
