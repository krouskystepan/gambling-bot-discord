import {
  bumpSessionStats,
  shouldAnnounceByMultiplier
} from 'gambling-bot-shared/casino'
import { formatMoney, sessionBetId } from 'gambling-bot-shared/common'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'
import type { SlotsSessionPhase } from 'gambling-bot-shared/slots'

import type { Guild, Message } from 'discord.js'

import {
  getSlotsGameByUserAndGuild,
  reserveCasinoBet,
  settleCasinoWinnings,
  updateSlotsGame
} from '@/services'
import { spinSlot } from '@/utils/casino/rng'
import { sleep } from '@/utils/common/utils'
import { createBetEmbed } from '@/utils/discord/createEmbed'
import { slotEmojis, spinSlotEmotes } from '@/utils/discord/customEmotes'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

import {
  renderSlotsComponents,
  renderSlotsMachineEmbed,
  slotsBatchTotal
} from './sessionRender'

/** Animated reel frame before each result. */
const SPIN_FRAME_MS = 1000
/** Hold resolved reels so each spin result is readable mid-batch. */
const RESULT_HOLD_MS = 1300

type EditableMessage = { edit: (...args: never[]) => Promise<unknown> }
type AnnounceGuild = Parameters<typeof tryAnnounceBigWin>[0]['guild']
type ResumePhase = Exclude<SlotsSessionPhase, 'spinning'>

const mapReels = (spinResult: string) =>
  spinResult.replace(/🍒|🫐|🍉|🔔|7️⃣/g, (match) => slotEmojis[match])

const netEmoji = (net: number) => (net > 0 ? '🟢' : net < 0 ? '🔴' : '🟡')

const formatBatchFrame = ({
  totalBet,
  reelsLine,
  liveNet,
  globalSettings
}: {
  totalBet: number
  reelsLine: string
  liveNet: number
  globalSettings: TGuildConfiguration['globalSettings']
}) =>
  [
    `💵 Total Bet: **${formatMoney(totalBet, globalSettings)}**`,
    '',
    `🕹 ${reelsLine}`,
    '',
    `💰 Running: ${netEmoji(liveNet)} **${formatMoney(liveNet, globalSettings)}**`
  ].join('\n')

const summarizeBatch = ({
  spinResults,
  unitBet,
  winMultipliers,
  announceMinMultiplier,
  globalSettings
}: {
  spinResults: string[]
  unitBet: number
  winMultipliers: TGuildConfiguration['casinoSettings']['slots']['winMultipliers']
  announceMinMultiplier: number
  globalSettings: TGuildConfiguration['globalSettings']
}) => {
  let totalWinnings = 0
  let liveNet = 0
  let winsCount = 0
  let lastReels = ''
  const announcementSpins: string[] = []
  const resultLines: string[] = []

  for (let i = 0; i < spinResults.length; i++) {
    const spinResult = spinResults[i]!
    const resultString = mapReels(spinResult)
    lastReels = resultString

    const spinMultiplier =
      (winMultipliers as Record<string, number>)[spinResult] || 0
    const winnings = spinMultiplier * unitBet
    const isWin = winnings > 0

    if (isWin) winsCount++

    if (shouldAnnounceByMultiplier(spinMultiplier, announceMinMultiplier)) {
      announcementSpins.push(
        formatBigWinLine({
          label: `Spin **${i + 1}**`,
          middle: [`**${resultString}**`],
          multiplier: String(spinMultiplier),
          payout: formatMoney(winnings, globalSettings),
          bet: formatMoney(unitBet, globalSettings)
        })
      )
    }

    totalWinnings += winnings
    liveNet += winnings - unitBet

    resultLines.push(
      `**${resultString}** | ${isWin ? '🎉' : '❌'} | ${
        isWin
          ? `**+${formatMoney(winnings, globalSettings)}**`
          : `**-${formatMoney(unitBet, globalSettings)}**`
      }`
    )
  }

  return {
    totalWinnings,
    liveNet,
    winsCount,
    lastReels,
    announcementSpins,
    resultLines
  }
}

export const settleSlotsFromBatch = async ({
  message,
  userId,
  guildId,
  gameId,
  unitBet,
  spinsCount,
  spinResults,
  showBalance,
  guild,
  guildConfig,
  sourceChannelId,
  betId
}: {
  message?: EditableMessage | null
  userId: string
  guildId: string
  gameId: string
  unitBet: number
  spinsCount: number
  spinResults: string[]
  showBalance: boolean
  guild: AnnounceGuild
  guildConfig: TGuildConfiguration
  sourceChannelId: string
  betId: string
}) => {
  const totalBet = slotsBatchTotal(unitBet, spinsCount)
  const { totalWinnings, liveNet, winsCount, lastReels, announcementSpins } =
    summarizeBatch({
      spinResults,
      unitBet,
      winMultipliers: guildConfig.casinoSettings.slots.winMultipliers,
      announceMinMultiplier:
        guildConfig.casinoSettings.winAnnouncements.slotsMinMultiplier,
      globalSettings: guildConfig.globalSettings
    })

  const finalBalance = await settleCasinoWinnings({
    userId,
    guildId,
    totalBet,
    winnings: totalWinnings,
    betId,
    game: 'slots',
    rounds: spinsCount
  })

  const existing = await getSlotsGameByUserAndGuild({ userId, guildId })
  if (!existing) {
    throw new Error('SLOTS_SESSION_MISSING')
  }
  const sessionStats = bumpSessionStats(existing.sessionStats, {
    totalBet,
    totalPayout: totalWinnings,
    rounds: spinsCount
  })

  await updateSlotsGame({
    userId,
    guildId,
    phase: 'result',
    lastReels,
    lastNetResult: liveNet,
    lastSpinsCount: spinsCount,
    lastTotalBet: totalBet,
    lastWinsCount: winsCount,
    pendingBatchResults: null,
    activeBetId: null,
    lockedAmount: null,
    sessionStats
  })

  if (message) {
    await message.edit({
      embeds: [
        renderSlotsMachineEmbed({
          gameId,
          phase: 'result',
          unitBet,
          spinsCount,
          lastNetResult: liveNet,
          lastSpinsCount: spinsCount,
          lastTotalBet: totalBet,
          lastWinsCount: winsCount,
          showBalance,
          finalBalance,
          globalSettings: guildConfig.globalSettings
        })
      ],
      components: renderSlotsComponents({
        gameId,
        phase: 'result',
        hasUnitBet: true,
        spinsCount
      })
    } as never)
  }

  if (announcementSpins.length > 0 && guild) {
    tryAnnounceBigWin({
      guild,
      guildConfig,
      game: 'slots',
      lines: announcementSpins,
      betId: gameId,
      sourceChannelId
    })
  }

  return {
    betId,
    lastReels,
    net: liveNet,
    winsCount,
    finalBalance
  }
}

export const recoverSlotsBatch = settleSlotsFromBatch

export const playSlotsRound = async ({
  message,
  userId,
  guildId,
  gameId,
  unitBet,
  spinsCount,
  showBalance,
  skipAnimations,
  previousPhase,
  guild,
  guildConfig,
  sourceChannelId
}: {
  message: Message
  userId: string
  guildId: string
  gameId: string
  unitBet: number
  spinsCount: number
  showBalance: boolean
  skipAnimations: boolean
  previousPhase: ResumePhase
  guild: Guild | null
  guildConfig: TGuildConfiguration
  sourceChannelId: string
}) => {
  const totalBet = slotsBatchTotal(unitBet, spinsCount)
  const existing = await getSlotsGameByUserAndGuild({ userId, guildId })
  const betId = sessionBetId(
    gameId,
    (existing?.sessionStats?.roundsPlayed ?? 0) + 1
  )
  const spinResults = Array.from({ length: spinsCount }, () =>
    spinSlot({
      symbolWeights: guildConfig.casinoSettings.slots.symbolWeights
    })
  )

  await updateSlotsGame({
    userId,
    guildId,
    phase: 'spinning',
    pendingBatchResults: spinResults,
    activeBetId: betId,
    lockedAmount: totalBet
  })

  try {
    await reserveCasinoBet({
      userId,
      guildId,
      totalBet,
      betId,
      game: 'slots',
      rounds: spinsCount
    })
  } catch {
    await updateSlotsGame({
      userId,
      guildId,
      phase: previousPhase,
      pendingBatchResults: null,
      activeBetId: null,
      lockedAmount: null
    })
    throw new Error('INSUFFICIENT_FUNDS')
  }

  let liveNet = 0

  for (let i = 0; i < spinResults.length; i++) {
    const spinResult = spinResults[i]!
    const resultString = mapReels(spinResult)
    const spinMultiplier =
      (
        guildConfig.casinoSettings.slots.winMultipliers as Record<
          string,
          number
        >
      )[spinResult] || 0
    const winnings = spinMultiplier * unitBet

    if (!skipAnimations) {
      await message.edit({
        embeds: [
          createBetEmbed(
            '🎰 Spinning...',
            'Blue',
            formatBatchFrame({
              totalBet,
              reelsLine: `${spinSlotEmotes[1]}${spinSlotEmotes[2]}${spinSlotEmotes[3]}`,
              liveNet,
              globalSettings: guildConfig.globalSettings
            }),
            gameId
          )
        ],
        components: []
      })
      await sleep(SPIN_FRAME_MS)
    }

    liveNet += winnings - unitBet

    if (!skipAnimations) {
      const isLast = i === spinResults.length - 1
      await message.edit({
        embeds: [
          createBetEmbed(
            '🎰 Spinning...',
            'Blue',
            formatBatchFrame({
              totalBet,
              reelsLine: resultString,
              liveNet,
              globalSettings: guildConfig.globalSettings
            }),
            gameId
          )
        ],
        components: []
      })
      if (!isLast) {
        await sleep(RESULT_HOLD_MS)
      }
    }
  }

  if (skipAnimations) {
    const { resultLines, liveNet: summaryNet } = summarizeBatch({
      spinResults,
      unitBet,
      winMultipliers: guildConfig.casinoSettings.slots.winMultipliers,
      announceMinMultiplier:
        guildConfig.casinoSettings.winAnnouncements.slotsMinMultiplier,
      globalSettings: guildConfig.globalSettings
    })

    await message.edit({
      embeds: [
        createBetEmbed(
          '🎰 Results',
          'Blue',
          [
            `💵 Total Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**`,
            '',
            `🕹 **Spin Results:**`,
            resultLines.join('\n'),
            '',
            `💰 Total: ${netEmoji(summaryNet)} **${formatMoney(summaryNet, guildConfig.globalSettings)}**`
          ].join('\n'),
          gameId
        )
      ],
      components: []
    })
    await sleep(RESULT_HOLD_MS * 1.5)
  }

  return settleSlotsFromBatch({
    message,
    userId,
    guildId,
    gameId,
    unitBet,
    spinsCount,
    spinResults,
    showBalance,
    guild,
    guildConfig,
    sourceChannelId,
    betId
  })
}
