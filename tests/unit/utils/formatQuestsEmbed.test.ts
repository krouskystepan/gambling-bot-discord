import { describe, expect, it } from 'vitest'

import {
  QUEST_PAGE_DESCRIPTION_BUDGET,
  buildQuestEmbedPages,
  formatQuestOverview,
  formatQuestProgressLine,
  resolveQuestPage
} from '@/utils/discord/formatQuestsEmbed'

describe('formatQuestProgressLine', () => {
  it('formats incomplete and complete quests', () => {
    expect(
      formatQuestProgressLine({
        done: false,
        name: 'Win 3 Blackjack',
        current: 0,
        threshold: 3,
        reward: '$500'
      })
    ).toBe('⬜ **Win 3 Blackjack** · 0/3 (+$500)')

    expect(
      formatQuestProgressLine({
        done: true,
        name: 'First Win',
        current: 1,
        threshold: 1,
        reward: '$1k'
      })
    ).toBe('✅ **First Win** · 1/1 (+$1k)')
  })
})

describe('formatQuestOverview', () => {
  it('shows date, counts, and browse hint', () => {
    const page = formatQuestOverview({
      dateKey: '2026-07-30',
      dailyDone: 1,
      dailyTotal: 3,
      normalDone: 0,
      normalTotal: 5
    })

    expect(page.view).toBe('overview')
    expect(page.title).toBe('Your Quests')
    expect(page.description).toContain('📅 **Today** · `2026-07-30`')
    expect(page.description).toContain('Daily **1/3** · Normal **0/5**')
    expect(page.description).toContain('Open Daily or Normal')
  })
})

describe('buildQuestEmbedPages', () => {
  const base = {
    dateKey: '2026-07-30',
    dailyDone: 0,
    dailyTotal: 0,
    normalDone: 0,
    normalTotal: 0
  }

  it('builds overview plus empty-state kind pages', () => {
    const pages = buildQuestEmbedPages({
      ...base,
      dailyLines: [],
      normalLines: []
    })

    expect(pages.overview.title).toBe('Your Quests')
    expect(pages.daily).toHaveLength(1)
    expect(pages.normal).toHaveLength(1)
    expect(pages.daily[0]?.title).toBe('Daily Quests')
    expect(pages.daily[0]?.description).toContain(
      '_No daily quests configured._'
    )
    expect(pages.normal[0]?.description).toContain(
      '_No normal quests configured._'
    )
  })

  it('keeps a short list on a single page without repeating overview stats', () => {
    const pages = buildQuestEmbedPages({
      ...base,
      dailyTotal: 2,
      dailyLines: ['⬜ **A** · 0/1 (+$1)', '✅ **B** · 1/1 (+$2)'],
      normalLines: ['⬜ **C** · 0/1 (+$3)'],
      normalTotal: 1
    })

    expect(pages.daily).toHaveLength(1)
    expect(pages.daily[0]?.description).toBe(
      '⬜ **A** · 0/1 (+$1)\n✅ **B** · 1/1 (+$2)'
    )
    expect(pages.daily[0]?.description).not.toContain('Today')
  })

  it('paginates when quest lines exceed the page budget', () => {
    const lines = Array.from({ length: 80 }, (_, i) =>
      `⬜ **Quest ${i}** · 0/1 (+$100)`.padEnd(90, '.')
    )
    const pages = buildQuestEmbedPages({
      ...base,
      dailyLines: lines,
      dailyTotal: lines.length,
      normalLines: []
    })

    expect(pages.daily.length).toBeGreaterThan(1)
    expect(pages.daily[0]?.pageCount).toBe(pages.daily.length)
    expect(pages.daily[0]?.title).toBe(`Daily Quests (1/${pages.daily.length})`)
    expect(pages.daily.at(-1)?.title).toBe(
      `Daily Quests (${pages.daily.length}/${pages.daily.length})`
    )

    for (const page of pages.daily) {
      expect(page.description.length).toBeLessThanOrEqual(
        QUEST_PAGE_DESCRIPTION_BUDGET
      )
    }
  })

  it('hard-slices a single oversized quest line', () => {
    const oversized = `⬜ **Huge** · 0/1 (+$1) ${'x'.repeat(QUEST_PAGE_DESCRIPTION_BUDGET)}`
    const pages = buildQuestEmbedPages({
      ...base,
      dailyLines: [oversized],
      dailyTotal: 1,
      normalLines: []
    })

    expect(pages.daily).toHaveLength(1)
    expect(pages.daily[0]?.description.length).toBeLessThanOrEqual(
      QUEST_PAGE_DESCRIPTION_BUDGET
    )
  })
})

describe('resolveQuestPage', () => {
  it('returns overview and clamps kind page indexes', () => {
    const pages = buildQuestEmbedPages({
      dateKey: '2026-07-30',
      dailyLines: ['⬜ **A** · 0/1 (+$1)'],
      normalLines: ['⬜ **B** · 0/1 (+$1)'],
      dailyDone: 0,
      dailyTotal: 1,
      normalDone: 0,
      normalTotal: 1
    })

    expect(
      resolveQuestPage({ pages, view: 'overview', pageIndex: 0 }).view
    ).toBe('overview')
    expect(
      resolveQuestPage({ pages, view: 'daily', pageIndex: -5 }).pageIndex
    ).toBe(0)
    expect(
      resolveQuestPage({ pages, view: 'normal', pageIndex: 99 }).pageIndex
    ).toBe(0)
  })
})
