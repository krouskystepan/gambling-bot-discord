/**
 * Short player-facing guides for `/help`.
 * Keep each blurb short - Discord embed descriptions are capped at 4096 characters.
 * Never include RTP, weights, house edge, or hit rates - those stay in the admin panel.
 */

export type CasinoGameGuide = {
  title: string
  /** Slash command players type (without leading /). */
  command: string
  /** Short usage example after the command name. */
  usage: string
  /** One or two sentences on how to play. */
  how: string
  /** Idle / session rules (instant games note that they settle immediately). */
  idle: string
}

const instantIdle =
  'Settles immediately - nothing stays locked after the result posts.'

export const casinoGameGuides = {
  coinflip: {
    title: '🪙 Coin Flip',
    command: 'coin-flip',
    usage: 'bet:2000 side:heads',
    how: 'Pick heads or tails, then flip once or many times. Wins pay the coinflip multiplier.',
    idle: instantIdle
  },
  hilo: {
    title: '🃏 Hi-Lo',
    command: 'hilo',
    usage: '',
    how: 'Open a table, set your bet, then Deal. Guess Higher, Draw, or Lower than the shown card. After a round: Rebet, Change bet, or Close.',
    idle: 'Waiting for a guess: DM reminder at ~30 minutes, then the safest side is auto-played at 1 hour. Empty tables close after ~24 hours.'
  },
  limbo: {
    title: '🚀 Limbo',
    command: 'limbo',
    usage: 'bet:2000 target:2',
    how: 'Set a target multiplier. If the crash point reaches your target, you win that multiplier; otherwise you lose the stake.',
    idle: instantIdle
  },
  dice: {
    title: '🎲 Dice',
    command: 'dice',
    usage: 'bet:3000 side:2',
    how: 'Pick a face (1-6). Matching your face pays the dice multiplier.',
    idle: instantIdle
  },
  goldenJackpot: {
    title: '🤑 Golden Jackpot',
    command: 'goldenjackpot',
    usage: 'bet:2500',
    how: 'Buy one or more entries. Each entry can hit the jackpot multiplier. Misses lose that entry stake.',
    idle: instantIdle
  },
  lottery: {
    title: '🎟️ Lottery',
    command: 'lottery',
    usage: 'bet:1000 numbers:5,4,3,10',
    how: 'Pick four numbers. Matching more numbers pays a higher tier from the lottery multipliers.',
    idle: instantIdle
  },
  plinko: {
    title: '🎯 Plinko',
    command: 'plinko',
    usage: 'bet:1000',
    how: 'Drop one or more balls down the peg board. Where each ball lands pays that bin multiplier.',
    idle: instantIdle
  },
  roulette: {
    title: '🌀 Roulette',
    command: 'roulette',
    usage: '',
    how: 'Open a live table, tap outcomes (modal for the amount), then Spin. Stack several bets on one spin. Rebet repeats your last slip; Change rebuilds it.',
    idle: 'DM reminder after ~3 hours idle. Tables with no new spin close after ~24 hours (locked chips are refunded).'
  },
  baccarat: {
    title: '🃏 Baccarat',
    command: 'baccarat',
    usage: '',
    how: 'Open a table, set your bet, then pick Player, Banker, or Tie. Closer hand to 9 wins. Rebet / Change / Close between rounds.',
    idle: 'DM reminder after ~3 hours idle. Tables close after ~24 hours of no new round.'
  },
  slots: {
    title: '🎰 Slots',
    command: 'slots',
    usage: '',
    how: 'Open a machine, set your bet, choose spins (1-10), then Spin. Matching symbol lines pay the listed multipliers.',
    idle: 'DM reminder after ~3 hours idle. Machines close after ~24 hours of no new spin.'
  },
  blackjack: {
    title: '🃏 Blackjack',
    command: 'blackjack',
    usage: '',
    how: 'Open a table, set your bet, then Deal. Hit / Stand / Double / Split - beat the dealer without going over 21. Rebet / Change / Close between hands.',
    idle: 'DM reminder after ~3 hours. Mid-hand games auto-stand after ~24 hours. Empty tables close after ~24 hours.'
  },
  mines: {
    title: '💣 Mines',
    command: 'mines',
    usage: '',
    how: 'Open a table, set stake and mine count, then Start. Reveal safe tiles to raise the multiplier, or Cash Out after the first safe tile.',
    idle: 'DM reminder after ~3 hours. Active boards auto-resolve after ~24 hours. Empty tables close after ~24 hours.'
  },
  rps: {
    title: '🪨📄✂️ RPS',
    command: 'rps',
    usage: 'player:@User bet:1500',
    how: 'Challenge another registered player. Both pick rock, paper, or scissors - winner takes the pot.',
    idle: 'About 30 seconds to pick. Timeout cancels the game and refunds both stakes.'
  },
  prediction: {
    title: '👀 Prediction',
    command: '',
    usage: '',
    how: 'Staff open markets with choices. Bet on an outcome before lock - winners split the pool when it resolves.',
    idle: 'Bets stay locked until the market locks and resolves.'
  },
  raffle: {
    title: '🎫 Raffle',
    command: '',
    usage: '',
    how: 'Join an open raffle with tickets from the raffle message buttons. Winners are drawn from entries.',
    idle: 'Entries stay until the raffle draws or is cancelled.'
  }
} as const satisfies Record<string, CasinoGameGuide>

export type CasinoGameGuideKey = keyof typeof casinoGameGuides

export const casinoGameGuideKeys = Object.keys(
  casinoGameGuides
) as CasinoGameGuideKey[]
