/** Leave headroom under Discord's 4096 description limit. */
export const QUEST_PAGE_DESCRIPTION_BUDGET = 3800

export type QuestViewTab = 'overview' | 'daily' | 'normal'

export type QuestKindTab = Exclude<QuestViewTab, 'overview'>

export type QuestEmbedPage = {
  view: QuestViewTab
  pageIndex: number
  pageCount: number
  title: string
  description: string
}

export const formatQuestProgressLine = ({
  done,
  name,
  current,
  threshold,
  reward
}: {
  done: boolean
  name: string
  current: number
  threshold: number
  reward: string
}): string => {
  const status = done ? '✅' : '⬜'
  return `${status} **${name}** · ${current}/${threshold} (+${reward})`
}

export const formatQuestOverview = ({
  dateKey,
  dailyDone,
  dailyTotal,
  normalDone,
  normalTotal
}: {
  dateKey: string
  dailyDone: number
  dailyTotal: number
  normalDone: number
  normalTotal: number
}): QuestEmbedPage => ({
  view: 'overview',
  pageIndex: 0,
  pageCount: 1,
  title: 'Info - Your Quests',
  description: [
    `📅 **Today** · \`${dateKey}\``,
    `Daily **${dailyDone}/${dailyTotal}** · Normal **${normalDone}/${normalTotal}**`,
    '',
    '_Open Daily or Normal to see your quests._'
  ].join('\n')
})

const kindLabel = (kind: QuestKindTab): string =>
  kind === 'daily' ? 'Daily' : 'Normal'

const emptyKindMessage = (kind: QuestKindTab): string =>
  kind === 'daily'
    ? '_No daily quests configured._'
    : '_No normal quests configured._'

const packQuestLinesIntoPages = (
  lines: string[],
  budget = QUEST_PAGE_DESCRIPTION_BUDGET
): string[] => {
  const pages: string[] = []
  let index = 0

  while (index < lines.length) {
    const chunk: string[] = []
    let used = 0

    while (index < lines.length) {
      const line = lines[index]!
      const addition = chunk.length === 0 ? line : `\n${line}`
      if (used + addition.length > budget) break
      chunk.push(line)
      used += addition.length
      index++
    }

    if (chunk.length === 0) {
      const line = lines[index]!
      chunk.push(line.slice(0, budget))
      index++
    }

    pages.push(chunk.join('\n'))
  }

  return pages
}

export const buildQuestEmbedPages = ({
  dateKey,
  dailyLines,
  normalLines,
  dailyDone,
  dailyTotal,
  normalDone,
  normalTotal
}: {
  dateKey: string
  dailyLines: string[]
  normalLines: string[]
  dailyDone: number
  dailyTotal: number
  normalDone: number
  normalTotal: number
}): {
  overview: QuestEmbedPage
  daily: QuestEmbedPage[]
  normal: QuestEmbedPage[]
} => {
  const toPages = (kind: QuestKindTab, lines: string[]): QuestEmbedPage[] => {
    const bodyLines = lines.length > 0 ? lines : [emptyKindMessage(kind)]
    const descriptions = packQuestLinesIntoPages(bodyLines)
    return descriptions.map((description, pageIndex) => ({
      view: kind,
      pageIndex,
      pageCount: descriptions.length,
      title:
        descriptions.length > 1
          ? `Info - ${kindLabel(kind)} Quests (${pageIndex + 1}/${descriptions.length})`
          : `Info - ${kindLabel(kind)} Quests`,
      description
    }))
  }

  return {
    overview: formatQuestOverview({
      dateKey,
      dailyDone,
      dailyTotal,
      normalDone,
      normalTotal
    }),
    daily: toPages('daily', dailyLines),
    normal: toPages('normal', normalLines)
  }
}

export const resolveQuestPage = ({
  pages,
  view,
  pageIndex
}: {
  pages: {
    overview: QuestEmbedPage
    daily: QuestEmbedPage[]
    normal: QuestEmbedPage[]
  }
  view: QuestViewTab
  pageIndex: number
}): QuestEmbedPage => {
  if (view === 'overview') return pages.overview

  const list = pages[view]
  const clamped = Math.min(Math.max(pageIndex, 0), list.length - 1)
  return list[clamped]!
}
