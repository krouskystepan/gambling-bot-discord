import crypto from 'crypto'
import {
  MINI_NUMBERS,
  shouldAnnounceByMultiplier
} from 'gambling-bot-shared/casino'
import { formatMoney, generateId } from 'gambling-bot-shared/common'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'
import type { TRouletteSlipBet } from 'gambling-bot-shared/roulette'

import type { Guild, Message } from 'discord.js'

import {
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
 * Single-zero wheel (IRL pocket order).
 * Spin animation scrolls this full strip; result lands on a mini (0–18) pocket only.
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

const WHEEL_ORDER: readonly string[] = SINGLE_ZERO_WHEEL_ORDER

const PLAYABLE_INDEXES = WHEEL_ORDER.map((n, i) =>
  n in MINI_NUMBERS ? i : -1
).filter((i) => i >= 0)
const WINDOW_RADIUS = 1

const randomInt = (minInclusive: number, maxExclusive: number) =>
  crypto.randomInt(minInclusive, maxExclusive)

/** Random scroll length each spin (6–10 pockets). */
const randomSpinPockets = () => randomInt(6, 11)

const FRAME_DELAY_MS = 550

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
 * Random length path on the single-zero strip that lands on a playable mini pocket.
 */
const planSpin = () => {
  const endIndex = PLAYABLE_INDEXES[randomInt(0, PLAYABLE_INDEXES.length)]!
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
  message: Message
  userId: string
  guildId: string
  gameId: string
  bets: TRouletteSlipBet[]
  showBalance: boolean
  skipAnimations: boolean
  guild: Guild | null
  guildConfig: TGuildConfiguration
  sourceChannelId: string
}) => {
  const totalBet = slipTotal(bets)
  const betId = generateId()

  await updateRouletteGame({
    userId,
    guildId,
    activeBetId: betId,
    lockedAmount: totalBet
  })

  try {
    await reserveCasinoBet({
      userId,
      guildId,
      totalBet,
      betId,
      game: 'roulette'
    })
  } catch {
    await updateRouletteGame({
      userId,
      guildId,
      activeBetId: null,
      lockedAmount: null
    })
    throw new Error('INSUFFICIENT_FUNDS')
  }

  const { centers, result: spinResult } = planSpin()

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
            betId
          )
        ],
        components: []
      })
      await sleep(FRAME_DELAY_MS)
    }
  }

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
    game: 'roulette'
  })

  await updateRouletteGame({
    userId,
    guildId,
    phase: 'result',
    bets: [],
    lastBets: bets,
    lastSpinResult: spinResult,
    lastNetResult: net,
    activeBetId: null,
    lockedAmount: null
  })

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
  })

  if (announcementHits.length > 0 && guild) {
    tryAnnounceBigWin({
      guild,
      guildConfig,
      game: 'roulette',
      lines: announcementHits,
      betId,
      sourceChannelId
    })
  }

  return { betId, spinResult, net, finalBalance, betLines }
}
