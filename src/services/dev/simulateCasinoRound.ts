import type { CasinoGameId, TCasinoSettings } from 'gambling-bot-shared/casino'
import {
  type HiloGuess,
  LIMBO_MAX_TARGET,
  LIMBO_MIN_TARGET,
  LOTTERY_NUM_TO_DRAW,
  LOTTERY_TOTAL_NUMBERS,
  PLINKO_ROW_COUNT,
  getHiloWinMultiplier,
  getPlinkoMultiplierAtPathIndex,
  isLimboWin,
  normalizePlinkoBinMultipliers,
  resolveHiloRound
} from 'gambling-bot-shared/casino'
import { generateId } from 'gambling-bot-shared/common'

import {
  drawGoldenJackpot,
  drawLottery,
  dropPlinkoBall,
  flipCoin,
  rollDice,
  rollHiloRanks,
  rollLimbo,
  spinRouletteWheel,
  spinSlot
} from '@/utils/casino/rng'
import { calculateRouletteWin } from '@/utils/casino/roulette/math'
import type { RouletteBet } from '@/utils/casino/roulette/types'

import {
  type MockCasinoGameId,
  pickBetAmountForGame,
  pickOpponentUser,
  randomChoice,
  randomInt,
  randomMockCasinoGame
} from './constants'
import { simulateBlackjackWinnings } from './simulateBlackjack'

export type SimulatedCasinoTx = {
  userId: string
  amount: number
  type: 'bet' | 'win'
  game: CasinoGameId
  referenceId: string
}

export type SimulatedCasinoRound = {
  transactions: SimulatedCasinoTx[]
}

const RPS_CHOICES = ['rock', 'paper', 'scissors'] as const
const RPS_BEATS: Record<(typeof RPS_CHOICES)[number], string> = {
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock'
}

type SimulateCtx = {
  casinoSettings: TCasinoSettings
  fallbackMaxBet: number
  userId: string
  userIds: string[]
  referenceId: string
}

function betTx(
  ctx: SimulateCtx,
  game: CasinoGameId,
  amount: number,
  userId = ctx.userId
): SimulatedCasinoTx {
  return {
    userId,
    amount,
    type: 'bet',
    game,
    referenceId: ctx.referenceId
  }
}

function winTx(
  ctx: SimulateCtx,
  game: CasinoGameId,
  amount: number,
  userId = ctx.userId
): SimulatedCasinoTx {
  return {
    userId,
    amount,
    type: 'win',
    game,
    referenceId: ctx.referenceId
  }
}

function singlePlayerRound(
  ctx: SimulateCtx,
  game: CasinoGameId,
  betAmount: number,
  winAmount: number
): SimulatedCasinoRound {
  const txs = [betTx(ctx, game, betAmount)]
  if (winAmount > 0) {
    txs.push(winTx(ctx, game, winAmount))
  }
  return { transactions: txs }
}

function randomLotteryPicks(): number[] {
  const pool = Array.from({ length: LOTTERY_TOTAL_NUMBERS }, (_, i) => i + 1)
  const picks: number[] = []

  for (let i = 0; i < LOTTERY_NUM_TO_DRAW; i++) {
    const idx = randomInt(0, pool.length - 1)
    picks.push(pool[idx]!)
    pool.splice(idx, 1)
  }

  return picks
}

function randomRouletteBet(betAmount: number): RouletteBet {
  const roll = Math.random()

  if (roll < 0.42) {
    const value = randomChoice(['red', 'black'])
    return { type: 'color', value, amount: betAmount, displayValue: value }
  }
  if (roll < 0.72) {
    const value = randomChoice(['even', 'odd'])
    return { type: 'parity', value, amount: betAmount, displayValue: value }
  }
  if (roll < 0.88) {
    const value = randomChoice(['low', 'high'])
    return { type: 'range', value, amount: betAmount, displayValue: value }
  }

  const value = String(randomInt(0, 18))
  return { type: 'number', value, amount: betAmount, displayValue: value }
}

function simulateRngGame(
  ctx: SimulateCtx,
  game: CasinoGameId,
  betAmount: number
): number {
  switch (game) {
    case 'dice': {
      const side = randomInt(1, 6)
      const rolled = rollDice()
      return rolled === side
        ? betAmount * ctx.casinoSettings.dice.winMultiplier
        : 0
    }
    case 'coinflip': {
      const side = randomChoice(['heads', 'tails'] as const)
      const flipped = flipCoin()
      return flipped === side
        ? betAmount * ctx.casinoSettings.coinflip.winMultiplier
        : 0
    }
    case 'hilo': {
      const { first, second } = rollHiloRanks()
      const houseEdge = ctx.casinoSettings.hilo.houseEdge
      const options = (['higher', 'lower'] as const).filter(
        (guess) => getHiloWinMultiplier(first, guess, houseEdge) != null
      )
      const guess = randomChoice(options) as HiloGuess
      const outcome = resolveHiloRound(first, second, guess)
      if (outcome === 'push') return betAmount
      if (outcome === 'lose') return 0
      const mult = getHiloWinMultiplier(first, guess, houseEdge) ?? 0
      return betAmount * mult
    }
    case 'limbo': {
      const houseEdge = ctx.casinoSettings.limbo.houseEdge
      const targetChoices = [1.5, 2, 5, 10, 25, 50, 100].filter(
        (t) => t >= LIMBO_MIN_TARGET && t <= LIMBO_MAX_TARGET
      )
      const target = randomChoice(targetChoices)
      const result = rollLimbo(houseEdge)
      return isLimboWin(result, target) ? betAmount * target : 0
    }
    case 'slots': {
      const spinResult = spinSlot({
        symbolWeights: ctx.casinoSettings.slots.symbolWeights
      })
      const multiplier =
        ctx.casinoSettings.slots.winMultipliers[spinResult] || 0
      return betAmount * multiplier
    }
    case 'lottery': {
      const userNumbers = randomLotteryPicks()
      const drawn = drawLottery()
      const matched = userNumbers.filter((n) => drawn.includes(n)).length as
        | 0
        | 1
        | 2
        | 3
        | 4
      const multiplier = ctx.casinoSettings.lottery.winMultipliers[matched] ?? 0
      return betAmount * multiplier
    }
    case 'roulette': {
      const bet = randomRouletteBet(betAmount)
      const spinResult = spinRouletteWheel()
      return calculateRouletteWin(
        bet,
        spinResult,
        ctx.casinoSettings.roulette.winMultipliers
      )
    }
    case 'plinko': {
      const binMultipliers = normalizePlinkoBinMultipliers(
        ctx.casinoSettings.plinko.binMultipliers
      )
      const finalBin = dropPlinkoBall(PLINKO_ROW_COUNT)
      const multiplier = getPlinkoMultiplierAtPathIndex(
        binMultipliers,
        finalBin
      )
      return betAmount * multiplier
    }
    case 'goldenJackpot': {
      const draw = drawGoldenJackpot(ctx.casinoSettings.goldenJackpot)
      return draw === 1
        ? betAmount * ctx.casinoSettings.goldenJackpot.winMultiplier
        : 0
    }
    default:
      return 0
  }
}

function simulateBlackjackRound(ctx: SimulateCtx): SimulatedCasinoRound {
  const betAmount = pickBetAmountForGame(
    ctx.casinoSettings,
    'blackjack',
    ctx.fallbackMaxBet
  )
  const winAmount = simulateBlackjackWinnings(betAmount)
  return singlePlayerRound(ctx, 'blackjack', betAmount, winAmount)
}

function simulateRpsRound(ctx: SimulateCtx): SimulatedCasinoRound {
  const betAmount = pickBetAmountForGame(
    ctx.casinoSettings,
    'rps',
    ctx.fallbackMaxBet
  )
  const opponentId = pickOpponentUser(ctx.userIds, ctx.userId)
  const p1Choice = randomChoice(RPS_CHOICES)
  const p2Choice = randomChoice(RPS_CHOICES)

  const txs: SimulatedCasinoTx[] = [
    betTx(ctx, 'rps', betAmount, ctx.userId),
    betTx(ctx, 'rps', betAmount, opponentId)
  ]

  const p1Wins = RPS_BEATS[p1Choice] === p2Choice
  const p2Wins = RPS_BEATS[p2Choice] === p1Choice

  if (p1Wins || p2Wins) {
    const winnerId = p1Wins ? ctx.userId : opponentId
    const pot = betAmount * 2
    const payout = Math.round(pot * (1 - ctx.casinoSettings.rps.houseEdge))
    txs.push(winTx(ctx, 'rps', payout, winnerId))
  }

  return { transactions: txs }
}

function simulatePredictionRound(ctx: SimulateCtx): SimulatedCasinoRound {
  const betAmount = pickBetAmountForGame(
    ctx.casinoSettings,
    'prediction',
    ctx.fallbackMaxBet
  )
  const choices = randomChoice([
    ['Yes', 'No'],
    ['Team A', 'Team B'],
    ['Over', 'Under']
  ] as const)
  const pickedChoice = randomChoice(choices)
  const odds = randomChoice([1.5, 1.8, 2, 2.5, 3, 4, 5])

  const txs: SimulatedCasinoTx[] = [betTx(ctx, 'prediction', betAmount)]

  // ~35% of bets are on resolved predictions (won or lost)
  if (Math.random() < 0.35) {
    const winningChoice = randomChoice(choices)
    if (winningChoice === pickedChoice) {
      txs.push(winTx(ctx, 'prediction', Math.round(betAmount * odds)))
    }
  }

  return { transactions: txs }
}

function simulateRaffleRound(ctx: SimulateCtx): SimulatedCasinoRound {
  const ticketPrice = pickBetAmountForGame(
    ctx.casinoSettings,
    'raffle',
    ctx.fallbackMaxBet
  )
  const tickets = randomInt(1, 5)
  const totalCost = ticketPrice * tickets

  const txs: SimulatedCasinoTx[] = [betTx(ctx, 'raffle', totalCost)]

  // ~18% - won a draw (pot after house cut, simulates shared ticket pool)
  if (Math.random() < 0.18) {
    const poolMultiplier = randomInt(4, 25)
    const pot = Math.round(
      totalCost * poolMultiplier * (1 - ctx.casinoSettings.raffle.houseEdge)
    )
    if (pot > 0) {
      txs.push(winTx(ctx, 'raffle', pot))
    }
  }

  return { transactions: txs }
}

function simulateByGame(
  ctx: SimulateCtx,
  game: CasinoGameId
): SimulatedCasinoRound {
  switch (game) {
    case 'blackjack':
      return simulateBlackjackRound(ctx)
    case 'rps':
      return simulateRpsRound(ctx)
    case 'prediction':
      return simulatePredictionRound(ctx)
    case 'raffle':
      return simulateRaffleRound(ctx)
    default: {
      const betAmount = pickBetAmountForGame(
        ctx.casinoSettings,
        game as Parameters<typeof pickBetAmountForGame>[1],
        ctx.fallbackMaxBet
      )
      const winAmount = simulateRngGame(ctx, game, betAmount)
      return singlePlayerRound(ctx, game, betAmount, winAmount)
    }
  }
}

export function simulateCasinoRound({
  casinoSettings,
  fallbackMaxBet,
  userId,
  userIds,
  game = randomMockCasinoGame()
}: {
  casinoSettings: TCasinoSettings
  fallbackMaxBet: number
  userId: string
  userIds: string[]
  game?: MockCasinoGameId
}): SimulatedCasinoRound {
  const ctx: SimulateCtx = {
    casinoSettings,
    fallbackMaxBet,
    userId,
    userIds,
    referenceId: generateId()
  }

  return simulateByGame(ctx, game)
}
