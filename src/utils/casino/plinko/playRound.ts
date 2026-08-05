import {
  PLINKO_ROW_COUNT,
  bumpSessionStats,
  getPlinkoMultiplierAtPathIndex,
  normalizePlinkoBinMultipliers,
  shouldAnnouncePlinkoBall
} from 'gambling-bot-shared/casino'
import { formatMoney, sessionBetId } from 'gambling-bot-shared/common'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'
import type { PlinkoSessionPhase } from 'gambling-bot-shared/plinko'

import type { Guild, Message } from 'discord.js'

import {
  getPlinkoGameByUserAndGuild,
  reserveCasinoBet,
  settleCasinoWinnings,
  updatePlinkoGame
} from '@/services'
import { dropPlinkoPath } from '@/utils/casino/rng'
import { sleep } from '@/utils/common/utils'
import { createBetEmbed } from '@/utils/discord/createEmbed'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

import { renderBoardFrame } from './render'
import {
  plinkoBatchTotal,
  renderPlinkoBoardEmbed,
  renderPlinkoComponents
} from './sessionRender'

/** Hold between multi-ball animation frames. */
const FRAME_MS = 350
/** Brief pause on skip-animations result summary. */
const RESULT_HOLD_MS = 1300
const SPAWN_DELAY_STEPS = 2

type EditableMessage = { edit: (...args: never[]) => Promise<unknown> }
type AnnounceGuild = Parameters<typeof tryAnnounceBigWin>[0]['guild']
type ResumePhase = Exclude<PlinkoSessionPhase, 'dropping'>

const netEmoji = (net: number) => (net > 0 ? '🟢' : net < 0 ? '🔴' : '🟡')

/** Running net for balls that have already reached their final bin at this step. */
export const liveNetAtDropStep = ({
  paths,
  globalStep,
  spawnDelay,
  unitBet,
  binMultipliers
}: {
  paths: number[][]
  globalStep: number
  spawnDelay: number
  unitBet: number
  binMultipliers: Record<string | number, number>
}): number => {
  let liveNet = 0

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]!
    const localStep = globalStep - i * spawnDelay
    // Ball has landed once it reaches (or passes) the last path index.
    if (localStep < path.length - 1) continue

    const finalBin = path[path.length - 1]!
    const multiplier = getPlinkoMultiplierAtPathIndex(binMultipliers, finalBin)
    liveNet += unitBet * multiplier - unitBet
  }

  return liveNet
}

export const summarizePlinkoBatch = ({
  paths,
  unitBet,
  binMultipliers,
  announceMinMultiplier,
  globalSettings
}: {
  paths: number[][]
  unitBet: number
  binMultipliers: Record<string | number, number>
  announceMinMultiplier: number
  globalSettings: TGuildConfiguration['globalSettings']
}) => {
  let totalWinnings = 0
  let liveNet = 0
  let winsCount = 0
  const announcementBalls: string[] = []
  const resultLines: string[] = []

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]!
    const finalBin = path[path.length - 1]!
    const multiplier = getPlinkoMultiplierAtPathIndex(binMultipliers, finalBin)
    const formattedMultiplier = Number(multiplier).toFixed(2)
    const winnings = unitBet * multiplier
    const netForBall = winnings - unitBet
    const isWin = multiplier > 1

    if (isWin) winsCount++

    totalWinnings += winnings
    liveNet += netForBall

    let displayValue: number
    let emoji: string

    if (multiplier > 1) {
      displayValue = winnings
      emoji = '🎉'
    } else if (multiplier < 1) {
      displayValue = netForBall
      emoji = '❌'
    } else {
      displayValue = 0
      emoji = '➖'
    }

    resultLines.push(
      `Ball **${i + 1}** - x${formattedMultiplier} | ${emoji} | ${formatMoney(displayValue, globalSettings)}`
    )

    if (shouldAnnouncePlinkoBall(multiplier, announceMinMultiplier)) {
      announcementBalls.push(
        formatBigWinLine({
          label: `Ball **${i + 1}**`,
          multiplier: formattedMultiplier,
          payout: formatMoney(winnings, globalSettings)
        })
      )
    }
  }

  return {
    totalWinnings,
    liveNet,
    winsCount,
    announcementBalls,
    resultLines
  }
}

export const settlePlinkoFromBatch = async ({
  message,
  userId,
  guildId,
  gameId,
  unitBet,
  ballsCount,
  paths,
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
  ballsCount: number
  paths: number[][]
  showBalance: boolean
  guild: AnnounceGuild
  guildConfig: TGuildConfiguration
  sourceChannelId: string
  betId: string
}) => {
  const totalBet = plinkoBatchTotal(unitBet, ballsCount)
  const binMultipliers = normalizePlinkoBinMultipliers(
    guildConfig.casinoSettings.plinko.binMultipliers
  )
  const { totalWinnings, liveNet, winsCount, announcementBalls } =
    summarizePlinkoBatch({
      paths,
      unitBet,
      binMultipliers,
      announceMinMultiplier:
        guildConfig.casinoSettings.winAnnouncements.plinkoMinMultiplier,
      globalSettings: guildConfig.globalSettings
    })

  const finalBalance = await settleCasinoWinnings({
    userId,
    guildId,
    totalBet,
    winnings: totalWinnings,
    betId,
    game: 'plinko',
    rounds: ballsCount
  })

  const existing = await getPlinkoGameByUserAndGuild({ userId, guildId })
  if (!existing) {
    throw new Error('PLINKO_SESSION_MISSING')
  }
  const sessionStats = bumpSessionStats(existing.sessionStats, {
    totalBet,
    totalPayout: totalWinnings,
    rounds: ballsCount
  })

  await updatePlinkoGame({
    userId,
    guildId,
    phase: 'result',
    lastNetResult: liveNet,
    lastBallsCount: ballsCount,
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
        renderPlinkoBoardEmbed({
          gameId,
          phase: 'result',
          unitBet,
          lastNetResult: liveNet,
          lastTotalBet: totalBet,
          lastBallsCount: ballsCount,
          showBalance,
          finalBalance,
          globalSettings: guildConfig.globalSettings,
          binMultipliers: guildConfig.casinoSettings.plinko.binMultipliers
        })
      ],
      components: renderPlinkoComponents({
        gameId,
        phase: 'result',
        hasUnitBet: true
      })
    } as never)
  }

  if (announcementBalls.length > 0 && guild) {
    tryAnnounceBigWin({
      guild,
      guildConfig,
      game: 'plinko',
      lines: announcementBalls,
      betId: gameId,
      sourceChannelId
    })
  }

  return {
    betId,
    net: liveNet,
    winsCount,
    finalBalance
  }
}

export const recoverPlinkoBatch = settlePlinkoFromBatch

export const playPlinkoRound = async ({
  message,
  userId,
  guildId,
  gameId,
  unitBet,
  ballsCount,
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
  ballsCount: number
  showBalance: boolean
  skipAnimations: boolean
  previousPhase: ResumePhase
  guild: Guild | null
  guildConfig: TGuildConfiguration
  sourceChannelId: string
}) => {
  const totalBet = plinkoBatchTotal(unitBet, ballsCount)
  const existing = await getPlinkoGameByUserAndGuild({ userId, guildId })
  const betId = sessionBetId(
    gameId,
    (existing?.sessionStats?.roundsPlayed ?? 0) + 1
  )
  const rows = PLINKO_ROW_COUNT
  const paths = Array.from({ length: ballsCount }, () => dropPlinkoPath(rows))
  const binMultipliers = normalizePlinkoBinMultipliers(
    guildConfig.casinoSettings.plinko.binMultipliers
  )

  await updatePlinkoGame({
    userId,
    guildId,
    phase: 'dropping',
    ballsCount,
    pendingBatchResults: paths,
    activeBetId: betId,
    lockedAmount: totalBet
  })

  try {
    await reserveCasinoBet({
      userId,
      guildId,
      totalBet,
      betId,
      game: 'plinko',
      rounds: ballsCount
    })
  } catch {
    await updatePlinkoGame({
      userId,
      guildId,
      phase: previousPhase,
      pendingBatchResults: null,
      activeBetId: null,
      lockedAmount: null
    })
    throw new Error('INSUFFICIENT_FUNDS')
  }

  const pathLength = rows + 1
  const totalTimelineSteps = pathLength + SPAWN_DELAY_STEPS * (ballsCount - 1)

  if (!skipAnimations) {
    for (let globalStep = 0; globalStep < totalTimelineSteps; globalStep++) {
      const liveNet = liveNetAtDropStep({
        paths,
        globalStep,
        spawnDelay: SPAWN_DELAY_STEPS,
        unitBet,
        binMultipliers
      })

      await message.edit({
        embeds: [
          createBetEmbed(
            ballsCount === 1 ? '🎯 Ball dropping...' : '🎯 Balls dropping...',
            'Blue',
            `💵 Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**\n\n` +
              renderBoardFrame(
                rows,
                paths,
                globalStep,
                SPAWN_DELAY_STEPS,
                binMultipliers
              ) +
              `\n\n💰 Total: ${netEmoji(liveNet)} **${formatMoney(liveNet, guildConfig.globalSettings)}**`,
            gameId
          )
        ],
        components: []
      })
      await sleep(FRAME_MS)
    }
  }

  const { resultLines, liveNet } = summarizePlinkoBatch({
    paths,
    unitBet,
    binMultipliers,
    announceMinMultiplier:
      guildConfig.casinoSettings.winAnnouncements.plinkoMinMultiplier,
    globalSettings: guildConfig.globalSettings
  })

  if (skipAnimations) {
    await message.edit({
      embeds: [
        createBetEmbed(
          '🎯 Results',
          'Blue',
          [
            `💵 Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**`,
            '',
            ballsCount === 1 ? '🎯 **Result:**' : '🎯 **Ball Results:**',
            resultLines.join('\n'),
            '',
            `💰 Total: ${netEmoji(liveNet)} **${formatMoney(liveNet, guildConfig.globalSettings)}**`
          ].join('\n'),
          gameId
        )
      ],
      components: []
    })
    await sleep(RESULT_HOLD_MS * 1.5)
  }

  return settlePlinkoFromBatch({
    message,
    userId,
    guildId,
    gameId,
    unitBet,
    ballsCount,
    paths,
    showBalance,
    guild,
    guildConfig,
    sourceChannelId,
    betId
  })
}
