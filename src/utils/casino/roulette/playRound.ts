import crypto from 'crypto'
import {
  bumpSessionStats,
  shouldAnnounceByMultiplier
} from 'gambling-bot-shared/casino'
import { formatMoney, sessionBetId } from 'gambling-bot-shared/common'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'
import type { TRouletteSlipBet } from 'gambling-bot-shared/roulette'

import {
  getRouletteGameByUserAndGuild,
  reserveCasinoBet,
  settleCasinoWinnings,
  updateRouletteGame
} from '@/services'
import { sleep } from '@/utils/common/utils'
import { createBetEmbed } from '@/utils/discord/createEmbed'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

import { calculateRouletteWin } from './math'
import { getRouletteColor } from './render'
import {
  renderRouletteComponents,
  renderRouletteTableEmbed,
  slipTotal
} from './sessionRender'
import { toRouletteBets } from './slip'

/**
 * European single-zero wheel (IRL pocket order).
 * Spin animation scrolls this strip; any pocket can land.
 */
const SINGLE_ZERO_WHEEL_ORDER = [
  '0',
  '32',
  '15',
  '19',
  '4',
  '21',
  '2',
  '25',
  '17',
  '34',
  '6',
  '27',
  '13',
  '36',
  '11',
  '30',
  '8',
  '23',
  '10',
  '5',
  '24',
  '16',
  '33',
  '1',
  '20',
  '14',
  '31',
  '9',
  '22',
  '18',
  '29',
  '7',
  '28',
  '12',
  '35',
  '3',
  '26'
] as const

export const WHEEL_ORDER: readonly string[] = SINGLE_ZERO_WHEEL_ORDER

const WINDOW_RADIUS = 1

const randomInt = (minInclusive: number, maxExclusive: number) =>
  crypto.randomInt(minInclusive, maxExclusive)

/** Random scroll length each spin (6–10 pockets). */
const randomSpinPockets = () => randomInt(6, 11)

const FRAME_DELAY_MS = 550
type EditableMessage = { edit: (...args: never[]) => Promise<unknown> }
type AnnounceGuild = Parameters<typeof tryAnnounceBigWin>[0]['guild']

const wrapIndex = (index: number) => {
  const len = WHEEL_ORDER.length
  return ((index % len) + len) % len
}

/** Fixed-width pocket for monospace alignment (emoji + 2-digit number). */
const formatPocket = (number: string) =>
  `${getRouletteColor(number)}${number.padStart(2, ' ')}`

const POCKET_SEP = ' │ '
const SAMPLE_POCKET = formatPocket('18')
/** Arrow stays fixed above the middle pocket for every frame. */
const ARROW_PAD =
  SAMPLE_POCKET.length +
  POCKET_SEP.length +
  Math.floor((SAMPLE_POCKET.length - 1) / 2)

/**
 * Three-pocket window in a code block. Arrow position is constant; only pockets scroll.
 */
export const formatSpinningWheelRow = (centerIndex: number) => {
  const left = formatPocket(
    WHEEL_ORDER[wrapIndex(centerIndex - WINDOW_RADIUS)]!
  )
  const mid = formatPocket(WHEEL_ORDER[wrapIndex(centerIndex)]!)
  const right = formatPocket(
    WHEEL_ORDER[wrapIndex(centerIndex + WINDOW_RADIUS)]!
  )

  return [
    '```',
    `${' '.repeat(ARROW_PAD)}↓`,
    `${left}${POCKET_SEP}${mid}${POCKET_SEP}${right}`,
    '```'
  ].join('\n')
}

/**
 * Random length path on the single-zero strip that lands on any pocket.
 */
export const planSpin = () => {
  const endIndex = randomInt(0, WHEEL_ORDER.length)
  const spinPockets = randomSpinPockets()
  const startIndex = wrapIndex(endIndex - (spinPockets - 1))
  const centers = Array.from({ length: spinPockets }, (_, step) =>
    wrapIndex(startIndex + step)
  )
  const result = WHEEL_ORDER[endIndex]!

  return { centers, result }
}

const formatSpinFrame = (
  centerIndex: number,
  totalBet: number,
  globalSettings: TGuildConfiguration['globalSettings']
) =>
  [
    `💵 Total Bet: **${formatMoney(totalBet, globalSettings)}**`,
    '',
    formatSpinningWheelRow(centerIndex)
  ].join('\n')

const settleRouletteFromResult = async ({
  message,
  userId,
  guildId,
  gameId,
  bets,
  spinResult,
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
  bets: TRouletteSlipBet[]
  spinResult: string
  showBalance: boolean
  guild: AnnounceGuild
  guildConfig: TGuildConfiguration
  sourceChannelId: string
  betId: string
}) => {
  const totalBet = slipTotal(bets)
  const color = getRouletteColor(spinResult)
  const rouletteBets = toRouletteBets(bets)
  let winnings = 0
  const announcementHits: string[] = []
  const betLines: string[] = []

  for (const bet of rouletteBets) {
    const winAmount = calculateRouletteWin(
      bet,
      spinResult,
      guildConfig.casinoSettings.roulette.winMultipliers
    )
    winnings += winAmount

    betLines.push(
      `**${formatMoney(bet.amount, guildConfig.globalSettings)}** on ${
        bet.displayValue
      } | ${
        winAmount > 0
          ? `🎉 | +${formatMoney(winAmount, guildConfig.globalSettings)}`
          : `❌ | -${formatMoney(bet.amount, guildConfig.globalSettings)}`
      }`
    )

    if (winAmount > 0) {
      const betMultiplier = winAmount / bet.amount
      if (
        shouldAnnounceByMultiplier(
          betMultiplier,
          guildConfig.casinoSettings.winAnnouncements.rouletteMinMultiplier
        )
      ) {
        announcementHits.push(
          formatBigWinLine({
            label: 'Roulette',
            middle: [`**${color} ${spinResult}**`, `**${bet.displayValue}**`],
            multiplier: betMultiplier.toFixed(2),
            payout: formatMoney(winAmount, guildConfig.globalSettings),
            bet: formatMoney(bet.amount, guildConfig.globalSettings)
          })
        )
      }
    }
  }

  const net = winnings - totalBet

  const finalBalance = await settleCasinoWinnings({
    userId,
    guildId,
    totalBet,
    winnings,
    betId,
    game: 'roulette',
    rounds: 1
  })

  const existing = await getRouletteGameByUserAndGuild({ userId, guildId })
  if (!existing) {
    throw new Error('ROULETTE_SESSION_MISSING')
  }
  const sessionStats = bumpSessionStats(existing.sessionStats, {
    totalBet,
    totalPayout: winnings
  })

  await updateRouletteGame({
    userId,
    guildId,
    phase: 'result',
    bets: [],
    lastBets: bets,
    lastSpinResult: spinResult,
    pendingSpinResult: null,
    lastNetResult: net,
    activeBetId: null,
    lockedAmount: null,
    sessionStats
  })

  if (message) {
    await message.edit({
      embeds: [
        renderRouletteTableEmbed({
          gameId,
          bets,
          phase: 'result',
          lastSpinResult: spinResult,
          lastNetResult: net,
          showBalance,
          finalBalance,
          globalSettings: guildConfig.globalSettings
        })
      ],
      components: renderRouletteComponents({
        gameId,
        phase: 'result',
        hasBets: false,
        hasLastBets: bets.length > 0
      })
    } as never)
  }

  if (announcementHits.length > 0 && guild) {
    tryAnnounceBigWin({
      guild,
      guildConfig,
      game: 'roulette',
      lines: announcementHits,
      betId: gameId,
      sourceChannelId
    })
  }

  return { betId, spinResult, net, finalBalance, betLines }
}

export const recoverRouletteSpin = async ({
  message,
  userId,
  guildId,
  gameId,
  bets,
  spinResult,
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
  bets: TRouletteSlipBet[]
  spinResult: string
  showBalance: boolean
  guild: AnnounceGuild
  guildConfig: TGuildConfiguration
  sourceChannelId: string
  betId: string
}) =>
  settleRouletteFromResult({
    message,
    userId,
    guildId,
    gameId,
    bets,
    spinResult,
    showBalance,
    guild,
    guildConfig,
    sourceChannelId,
    betId
  })

export const playRouletteSpin = async ({
  message,
  userId,
  guildId,
  gameId,
  bets,
  showBalance,
  skipAnimations,
  guild,
  guildConfig,
  sourceChannelId
}: {
  message: EditableMessage
  userId: string
  guildId: string
  gameId: string
  bets: TRouletteSlipBet[]
  showBalance: boolean
  skipAnimations: boolean
  guild: AnnounceGuild
  guildConfig: TGuildConfiguration
  sourceChannelId: string
}) => {
  const totalBet = slipTotal(bets)
  const existing = await getRouletteGameByUserAndGuild({ userId, guildId })
  const betId = sessionBetId(
    gameId,
    (existing?.sessionStats?.roundsPlayed ?? 0) + 1
  )

  const { centers, result: spinResult } = planSpin()

  await updateRouletteGame({
    userId,
    guildId,
    phase: 'spinning',
    pendingSpinResult: spinResult,
    activeBetId: betId,
    lockedAmount: totalBet
  })

  try {
    await reserveCasinoBet({
      userId,
      guildId,
      totalBet,
      betId,
      game: 'roulette',
      rounds: 1
    })
  } catch {
    await updateRouletteGame({
      userId,
      guildId,
      phase: 'betting',
      pendingSpinResult: null,
      activeBetId: null,
      lockedAmount: null
    })
    throw new Error('INSUFFICIENT_FUNDS')
  }

  if (!skipAnimations) {
    for (let step = 0; step < centers.length; step++) {
      await message.edit({
        embeds: [
          createBetEmbed(
            '🌀 Spinning...',
            'Blue',
            formatSpinFrame(
              centers[step]!,
              totalBet,
              guildConfig.globalSettings
            ),
            gameId
          )
        ],
        components: []
      } as never)
      await sleep(FRAME_DELAY_MS)
    }
  }

  return settleRouletteFromResult({
    message,
    userId,
    guildId,
    gameId,
    bets,
    spinResult,
    showBalance,
    guild,
    guildConfig,
    sourceChannelId,
    betId
  })
}
