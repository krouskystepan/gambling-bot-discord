export type BigWinGame =
  | 'dice'
  | 'coin-flip'
  | 'hilo'
  | 'limbo'
  | 'slots'
  | 'roulette'
  | 'baccarat'
  | 'plinko'
  | 'lottery'
  | 'goldenjackpot'
  | 'blackjack'

export const BIG_WIN_HEADLINES: Record<BigWinGame, string> = {
  dice: 'Someone won big on Dice!',
  'coin-flip': 'Someone won big on Coin Flip!',
  hilo: 'Someone won big on Hi-Lo!',
  limbo: 'Someone won big on Limbo!',
  slots: 'Someone won big on Slots!',
  roulette: 'Someone won big on Roulette!',
  baccarat: 'Someone won big on Baccarat!',
  plinko: 'Someone won big on Plinko!',
  lottery: 'Someone won big on Lottery!',
  goldenjackpot: 'Someone hit the Golden Jackpot!',
  blackjack: 'Someone won big on Blackjack!'
}

export const formatBigWinLine = ({
  label,
  middle = [],
  multiplier,
  payout,
  bet
}: {
  label: string
  middle?: string[]
  multiplier: string
  payout: string
  bet?: string
}): string => {
  const head = [label, ...middle, `**x${multiplier}**`].join(' - ')
  const line = `${head} → **${payout}**`
  return bet ? `${line} (bet **${bet}**)` : line
}

export const formatBigWinMessage = ({
  game,
  lines,
  betId
}: {
  game: BigWinGame
  lines: string[]
  betId?: string
}): string => {
  const parts = [`🎉 **${BIG_WIN_HEADLINES[game]}**`, '', ...lines]

  if (betId) {
    parts.push('', `\`ID: ${betId}\``)
  }

  return parts.join('\n')
}
