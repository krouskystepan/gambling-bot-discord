/**
 * Short player-facing guides for `/casino-games` and `/casino-info`.
 * Keep each blurb short - Discord messages are capped at 2000 characters.
 */

export type CasinoGameGuide = {
  title: string
  /** One or two sentences on how to play. */
  how: string
  /**
   * What happens if a live table / locked stake sits unused.
   * Omit for instant games that settle in one reply.
   */
  idle?: string
}

const instantIdle =
  'Settles immediately - nothing stays locked after the result posts.'

export const casinoGameGuides = {
  coinflip: {
    title: '🪙 Coin Flip',
    how: 'Pick heads or tails, then flip once or many times in a row. Each flip pays the coinflip multiplier on a win.',
    idle: instantIdle
  },
  hilo: {
    title: '🃏 Hi-Lo',
    how: 'Open a table, set your bet, then Deal. Guess Higher, Draw (same rank), or Lower than the shown card. After a round: Rebet, Change bet, or Close.',
    idle: 'Waiting for a guess: DM reminder at ~30 minutes, then the safest side (lowest odds) is auto-played at 1 hour. Empty or finished tables close after ~24 hours.'
  },
  limbo: {
    title: '🚀 Limbo',
    how: 'Set a target multiplier. The game rolls a crash point - if it reaches your target, you win that multiplier; otherwise you lose the stake.',
    idle: instantIdle
  },
  dice: {
    title: '🎲 Dice',
    how: 'Pick a face (1-6). The die rolls - matching your face pays the dice multiplier.',
    idle: instantIdle
  },
  goldenJackpot: {
    title: '🤑 Golden Jackpot',
    how: 'Buy one or more entries. Each entry has a tiny chance to hit the jackpot multiplier. Misses lose the stake for that entry.',
    idle: instantIdle
  },
  lottery: {
    title: '🎟️ Lottery',
    how: 'Pick four numbers. Matching more numbers pays a higher tier from the lottery multipliers.',
    idle: instantIdle
  },
  plinko: {
    title: '🎯 Plinko',
    how: 'Drop one or more balls down the peg board. Where each ball lands pays that bin multiplier.',
    idle: instantIdle
  },
  roulette: {
    title: '🌀 Roulette',
    how: 'Open a live table, tap outcomes (modal for the amount), then Spin. You can stack several bets on one spin. Rebet repeats your last slip; Change rebuilds it.',
    idle: 'DM reminder after ~3 hours idle. Tables with no new spin close after ~24 hours (locked chips are refunded).'
  },
  baccarat: {
    title: '🃏 Baccarat',
    how: 'Open a table, set your bet, then pick Player, Banker, or Tie. Cards are dealt and the closer hand to 9 wins. Rebet / Change / Close between rounds.',
    idle: 'DM reminder after ~3 hours idle. Tables close after ~24 hours of no new round.'
  },
  slots: {
    title: '🎰 Slots',
    how: 'Open a machine, set your bet, choose spins (1-10), then Spin. Matching symbol lines pay the listed multipliers.',
    idle: 'DM reminder after ~3 hours idle. Machines close after ~24 hours of no new spin.'
  },
  blackjack: {
    title: '🃏 Blackjack',
    how: 'Open a table, set your bet, then Deal. Hit / Stand / Double / Split as usual - beat the dealer without going over 21. Rebet / Change / Close between hands.',
    idle: 'DM reminder after ~3 hours. Mid-hand games auto-stand after ~24 hours. Empty or finished tables close after ~24 hours.'
  },
  mines: {
    title: '💣 Mines',
    how: 'Open a table, set stake and mine count, then Start. Reveal safe tiles to raise the multiplier, or Cash Out anytime after the first safe tile.',
    idle: 'DM reminder after ~3 hours. Active boards auto-resolve after ~24 hours (cash out if you revealed something, otherwise forfeit). Empty tables close after ~24 hours.'
  },
  rps: {
    title: '🪨📄✂️ RPS',
    how: 'Challenge another registered player. Both pick rock, paper, or scissors - winner takes the pot (house edge applies).',
    idle: 'Each player has about 30 seconds to pick. If someone times out, the game cancels and both stakes are refunded.'
  },
  prediction: {
    title: '👀 Prediction',
    how: 'Staff open markets with choices. Players bet on an outcome before lock - winners split the pool when the market resolves.',
    idle: 'Bets stay locked until the market locks and resolves. Unused markets can be cancelled by staff.'
  },
  raffle: {
    title: '🎫 Raffle',
    how: 'Join an open raffle with tickets. When it draws, winners are picked at random from entries (house edge applies to the prize pool).',
    idle: 'Entries stay until the raffle draws or is cancelled.'
  }
} as const satisfies Record<string, CasinoGameGuide>

export const formatGameGuideBody = (
  guide: CasinoGameGuide,
  extras: string[] = []
): string => {
  const lines = [`**How it works**\n${guide.how}`]

  if (guide.idle) {
    lines.push(`**If you go idle**\n${guide.idle}`)
  }

  if (extras.length) {
    lines.push(...extras)
  }

  return lines.join('\n\n')
}
