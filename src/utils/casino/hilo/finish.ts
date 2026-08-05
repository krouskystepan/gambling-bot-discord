import {
  type HiloGuess,
  type THiloGame,
  applyHiloGuess,
  bumpSessionStats,
  cashOutHiloPayout,
  docToHiloEngine,
  getHiloWinMultiplier,
  resolveIdleHilo,
  shouldAnnounceByMultiplier
} from 'gambling-bot-shared/casino'
import { formatMoney } from 'gambling-bot-shared/common'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'

import {
  claimHiloGameForSettle,
  getUser,
  settleCasinoWinnings,
  updateHiloGame
} from '@/services'
import type { HiloCard } from '@/utils/casino/rng'
import { formatHiloCard } from '@/utils/casino/rng'
import { sleep } from '@/utils/common/utils'
import { createBetEmbed } from '@/utils/discord/createEmbed'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

import {
  renderHiloCashOutEmbed,
  renderHiloGuessComponents,
  renderHiloPromptEmbed,
  renderHiloResultComponents,
  renderHiloResultEmbed,
  renderHiloRevealEmbed
} from './render'

type EditableMessage = { edit: (...args: never[]) => Promise<unknown> }
type AnnounceGuild = Parameters<typeof tryAnnounceBigWin>[0]['guild']

/** Copy card fields explicitly - mongoose subdocs do not spread via `{...card}`. */
const toHiloCard = (card: NonNullable<THiloGame['firstCard']>): HiloCard => ({
  label: card.label,
  suite: card.suite,
  rank: card.rank
})

const formatStoredCard = (card: NonNullable<THiloGame['firstCard']>) =>
  formatHiloCard(toHiloCard(card))

const parkInResult = async ({
  game,
  sessionStats,
  betAmount
}: {
  game: THiloGame
  sessionStats: THiloGame['sessionStats']
  betAmount: number
}) =>
  updateHiloGame({
    userId: game.userId,
    guildId: game.guildId,
    status: 'RESULT',
    activeBetId: null,
    betAmount,
    firstCard: null,
    remainingDeck: [],
    currentMultiplier: 1,
    streak: 0,
    sessionStats
  })

const resolveBalanceForEmbed = async ({
  game,
  settleBalance
}: {
  game: THiloGame
  settleBalance: number
}) => {
  if (!game.showBalance) return settleBalance
  const user = await getUser({
    userId: game.userId,
    guildId: game.guildId
  })
  if (!user) return settleBalance
  return user.balance + user.lockedBalance
}

const announceHiloWin = ({
  guild,
  guildConfig,
  gameId,
  sourceChannelId,
  stake,
  multiplier,
  payout,
  middle
}: {
  guild: AnnounceGuild
  guildConfig: TGuildConfiguration
  gameId: string
  sourceChannelId: string
  stake: number
  multiplier: number
  payout: number
  middle: string[]
}) => {
  if (
    !shouldAnnounceByMultiplier(
      multiplier,
      guildConfig.casinoSettings.winAnnouncements.hiloMinMultiplier
    )
  ) {
    return
  }

  tryAnnounceBigWin({
    guild,
    guildConfig,
    game: 'hilo',
    lines: [
      formatBigWinLine({
        label: 'Hi-Lo',
        middle,
        multiplier: multiplier.toFixed(2),
        payout: formatMoney(payout, guildConfig.globalSettings),
        bet: formatMoney(stake, guildConfig.globalSettings)
      })
    ],
    betId: gameId,
    sourceChannelId
  })
}

const renderContinuePrompt = ({
  game,
  stake,
  firstCard,
  remainingDeck,
  streak,
  currentMultiplier,
  houseEdge,
  globalSettings
}: {
  game: THiloGame
  stake: number
  firstCard: HiloCard
  remainingDeck: HiloCard[]
  streak: number
  currentMultiplier: number
  houseEdge: number
  globalSettings: TGuildConfiguration['globalSettings']
}) => {
  const higherMult = getHiloWinMultiplier(
    firstCard.rank,
    'higher',
    houseEdge,
    remainingDeck
  )
  const lowerMult = getHiloWinMultiplier(
    firstCard.rank,
    'lower',
    houseEdge,
    remainingDeck
  )
  const sameMult = getHiloWinMultiplier(
    firstCard.rank,
    'same',
    houseEdge,
    remainingDeck
  )

  return {
    embeds: [
      renderHiloPromptEmbed({
        firstCard: formatHiloCard(firstCard),
        higherMult,
        lowerMult,
        sameMult,
        bet: stake,
        streak,
        currentMultiplier,
        betId: game.gameId,
        globalSettings
      })
    ],
    components: renderHiloGuessComponents({
      gameId: game.gameId,
      firstRank: firstCard.rank,
      houseEdge,
      remainingDeck,
      streak,
      currentMultiplier
    })
  }
}

const settleAndPark = async ({
  game,
  stake,
  betId,
  payout,
  sessionStats
}: {
  game: THiloGame
  stake: number
  betId: string
  payout: number
  sessionStats: THiloGame['sessionStats']
}) => {
  const finalBalance = await settleCasinoWinnings({
    userId: game.userId,
    guildId: game.guildId,
    totalBet: stake,
    winnings: payout,
    betId,
    game: 'hilo',
    rounds: 1
  })

  const nextStats = bumpSessionStats(sessionStats, {
    totalBet: stake,
    totalPayout: payout
  })

  await parkInResult({ game, sessionStats: nextStats, betAmount: stake })

  return { finalBalance, sessionStats: nextStats, liveResult: payout - stake }
}

export const settleHiloGuess = async ({
  game,
  guess,
  guildConfig,
  guild,
  sourceChannelId,
  message,
  autoPlayed = false,
  /** When true (timeout first guess), cash out immediately after a winning continue. */
  cashOutAfterWin = false
}: {
  game: THiloGame
  guess: HiloGuess
  guildConfig: TGuildConfiguration
  guild: AnnounceGuild
  sourceChannelId: string
  message?: EditableMessage | null
  /** True when the worker auto-picked the safest side after a guess timeout. */
  autoPlayed?: boolean
  cashOutAfterWin?: boolean
}) => {
  const claimed = await claimHiloGameForSettle({
    gameId: game.gameId,
    guildId: game.guildId
  })
  if (!claimed) return null

  const stake = claimed.betAmount
  const firstStored = claimed.firstCard
  const betId = claimed.activeBetId
  if (stake == null || !firstStored || !betId) {
    await parkInResult({
      game: claimed,
      sessionStats: claimed.sessionStats,
      betAmount: stake ?? 0
    })
    return null
  }

  const engine = docToHiloEngine(claimed)
  const firstCard = formatStoredCard(firstStored)
  const stepMultiplier = getHiloWinMultiplier(
    firstStored.rank,
    guess,
    claimed.houseEdgeSnapshot,
    engine.remainingDeck
  )

  if (stepMultiplier == null) {
    await settleCasinoWinnings({
      userId: claimed.userId,
      guildId: claimed.guildId,
      totalBet: stake,
      winnings: stake,
      betId,
      game: 'hilo',
      rounds: 1
    })

    const sessionStats = bumpSessionStats(claimed.sessionStats, {
      totalBet: stake,
      totalPayout: stake
    })

    await parkInResult({ game: claimed, sessionStats, betAmount: stake })

    if (message) {
      await message.edit({
        embeds: [
          createBetEmbed(
            '🃏 Hi-Lo',
            'Yellow',
            [
              `💵 Bet: **${formatMoney(stake, guildConfig.globalSettings)}**`,
              `**Card**\n${firstCard}`,
              'That side cannot win - your bet was returned.',
              '_Rebet keeps the same stake, or Change to edit._'
            ].join('\n\n'),
            claimed.gameId
          )
        ],
        components: renderHiloResultComponents({ gameId: claimed.gameId })
      } as never)
    }

    return null
  }

  if (message && !claimed.skipAnimations) {
    await message.edit({
      embeds: [
        renderHiloRevealEmbed({
          firstCard,
          guess,
          winMultiplier: stepMultiplier,
          bet: stake,
          streak: engine.streak,
          currentMultiplier: engine.currentMultiplier,
          betId: claimed.gameId,
          globalSettings: guildConfig.globalSettings
        })
      ],
      components: []
    } as never)
    await sleep(700)
  }

  const applied = applyHiloGuess(engine, guess)

  if (applied.kind === 'IGNORED' || applied.kind === 'IMPOSSIBLE') {
    await parkInResult({
      game: claimed,
      sessionStats: claimed.sessionStats,
      betAmount: stake
    })
    return null
  }

  const secondCard = formatHiloCard(toHiloCard(applied.revealed))

  if (applied.kind === 'CONTINUE') {
    if (cashOutAfterWin) {
      engine.streak = applied.streak
      engine.currentMultiplier = applied.currentMultiplier
      const cash = cashOutHiloPayout(engine)
      if (cash.kind !== 'OK') {
        await parkInResult({
          game: claimed,
          sessionStats: claimed.sessionStats,
          betAmount: stake
        })
        return null
      }

      const settled = await settleAndPark({
        game: claimed,
        stake,
        betId,
        payout: cash.payout,
        sessionStats: claimed.sessionStats
      })

      const balanceForEmbed = await resolveBalanceForEmbed({
        game: claimed,
        settleBalance: settled.finalBalance
      })

      if (message) {
        await message.edit({
          embeds: [
            renderHiloCashOutEmbed({
              firstCard: secondCard,
              bet: stake,
              streak: cash.streak,
              multiplier: cash.multiplier,
              payout: cash.payout,
              liveResult: settled.liveResult,
              showBalance: claimed.showBalance,
              finalBalance: balanceForEmbed,
              betId: claimed.gameId,
              globalSettings: guildConfig.globalSettings,
              autoPlayed: true
            })
          ],
          components: renderHiloResultComponents({ gameId: claimed.gameId })
        } as never)
      }

      announceHiloWin({
        guild,
        guildConfig,
        gameId: claimed.gameId,
        sourceChannelId,
        stake,
        multiplier: cash.multiplier,
        payout: cash.payout,
        middle: [`**${firstCard}** → **${secondCard}** (${guess}, auto)`]
      })

      return {
        outcome: 'win' as const,
        totalWinnings: cash.payout,
        liveResult: settled.liveResult,
        sessionStats: settled.sessionStats,
        continued: false
      }
    }

    await updateHiloGame({
      userId: claimed.userId,
      guildId: claimed.guildId,
      status: 'WAITING',
      firstCard: engine.firstCard,
      remainingDeck: engine.remainingDeck,
      currentMultiplier: engine.currentMultiplier,
      streak: engine.streak
    })

    if (message) {
      const prompt = renderContinuePrompt({
        game: claimed,
        stake,
        firstCard: toHiloCard(engine.firstCard),
        remainingDeck: engine.remainingDeck.map(toHiloCard),
        streak: engine.streak,
        currentMultiplier: engine.currentMultiplier,
        houseEdge: claimed.houseEdgeSnapshot,
        globalSettings: guildConfig.globalSettings
      })
      await message.edit(prompt as never)
    }

    return {
      outcome: 'win' as const,
      totalWinnings: null,
      liveResult: null,
      sessionStats: claimed.sessionStats,
      continued: true,
      currentMultiplier: engine.currentMultiplier,
      streak: engine.streak
    }
  }

  const payout = applied.payout
  const settleMultiplier =
    applied.kind === 'DECK_EMPTY_CASHOUT' ? applied.currentMultiplier : 0

  const settled = await settleAndPark({
    game: claimed,
    stake,
    betId,
    payout,
    sessionStats: claimed.sessionStats
  })

  const balanceForEmbed = await resolveBalanceForEmbed({
    game: claimed,
    settleBalance: settled.finalBalance
  })

  if (message) {
    await message.edit({
      embeds: [
        renderHiloResultEmbed({
          firstCard,
          secondCard,
          guess,
          winMultiplier:
            applied.kind === 'DECK_EMPTY_CASHOUT'
              ? applied.currentMultiplier
              : stepMultiplier,
          bet: stake,
          liveResult: settled.liveResult,
          showBalance: claimed.showBalance,
          finalBalance: balanceForEmbed,
          betId: claimed.gameId,
          globalSettings: guildConfig.globalSettings,
          autoPlayed,
          streak:
            applied.kind === 'DECK_EMPTY_CASHOUT' ? applied.streak : undefined
        })
      ],
      components: renderHiloResultComponents({ gameId: claimed.gameId })
    } as never)
  }

  if (applied.kind === 'DECK_EMPTY_CASHOUT') {
    announceHiloWin({
      guild,
      guildConfig,
      gameId: claimed.gameId,
      sourceChannelId,
      stake,
      multiplier: settleMultiplier,
      payout,
      middle: [`**${firstCard}** → **${secondCard}** (${guess}, deck cleared)`]
    })
  }

  return {
    outcome: applied.kind === 'BUST' ? ('lose' as const) : ('win' as const),
    totalWinnings: payout,
    liveResult: settled.liveResult,
    sessionStats: settled.sessionStats,
    continued: false
  }
}

export const cashOutHilo = async ({
  game,
  guildConfig,
  guild,
  sourceChannelId,
  message,
  autoPlayed = false
}: {
  game: THiloGame
  guildConfig: TGuildConfiguration
  guild: AnnounceGuild
  sourceChannelId: string
  message?: EditableMessage | null
  autoPlayed?: boolean
}) => {
  const claimed = await claimHiloGameForSettle({
    gameId: game.gameId,
    guildId: game.guildId
  })
  if (!claimed) return null

  const stake = claimed.betAmount
  const firstStored = claimed.firstCard
  const betId = claimed.activeBetId
  if (stake == null || !firstStored || !betId) {
    await parkInResult({
      game: claimed,
      sessionStats: claimed.sessionStats,
      betAmount: stake ?? 0
    })
    return null
  }

  const engine = docToHiloEngine(claimed)
  const cash = cashOutHiloPayout(engine)
  if (cash.kind === 'IGNORED') {
    // Lost the race or streak is 0 - restore WAITING if we claimed.
    await updateHiloGame({
      userId: claimed.userId,
      guildId: claimed.guildId,
      status: 'WAITING'
    })
    return null
  }

  const settled = await settleAndPark({
    game: claimed,
    stake,
    betId,
    payout: cash.payout,
    sessionStats: claimed.sessionStats
  })

  const balanceForEmbed = await resolveBalanceForEmbed({
    game: claimed,
    settleBalance: settled.finalBalance
  })
  const firstCard = formatStoredCard(firstStored)

  if (message) {
    await message.edit({
      embeds: [
        renderHiloCashOutEmbed({
          firstCard,
          bet: stake,
          streak: cash.streak,
          multiplier: cash.multiplier,
          payout: cash.payout,
          liveResult: settled.liveResult,
          showBalance: claimed.showBalance,
          finalBalance: balanceForEmbed,
          betId: claimed.gameId,
          globalSettings: guildConfig.globalSettings,
          autoPlayed
        })
      ],
      components: renderHiloResultComponents({ gameId: claimed.gameId })
    } as never)
  }

  announceHiloWin({
    guild,
    guildConfig,
    gameId: claimed.gameId,
    sourceChannelId,
    stake,
    multiplier: cash.multiplier,
    payout: cash.payout,
    middle: [
      `Cashed out **${cash.streak}** streak on **${firstCard}**${
        autoPlayed ? ' (auto)' : ''
      }`
    ]
  })

  return {
    totalWinnings: cash.payout,
    liveResult: settled.liveResult,
    sessionStats: settled.sessionStats,
    multiplier: cash.multiplier
  }
}

/** Timed-out waiting rounds: cash out if streak ≥ 1, else safest auto-guess. */
export const settleHiloTimeout = async ({
  game,
  guildConfig,
  guild = null,
  message
}: {
  game: THiloGame
  guildConfig: TGuildConfiguration | null
  guild?: AnnounceGuild
  message?: EditableMessage | null
}) => {
  if (!guildConfig) return null

  const firstStored = game.firstCard
  if (!firstStored || game.betAmount == null) return null

  const engine = docToHiloEngine(game)
  const idle = resolveIdleHilo({ ...engine })

  if (idle.kind === 'CASH_OUT') {
    return cashOutHilo({
      game,
      guildConfig,
      guild,
      sourceChannelId: game.channelId,
      message,
      autoPlayed: true
    })
  }

  return settleHiloGuess({
    game,
    guess: idle.guess,
    guildConfig,
    guild,
    sourceChannelId: game.channelId,
    message,
    autoPlayed: true,
    cashOutAfterWin: true
  })
}
