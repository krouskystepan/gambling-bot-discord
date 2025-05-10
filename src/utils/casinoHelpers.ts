import { Card } from './blackjackUtils'

export function spinSlot(slotConfig: {
  symbolWeights: Record<string, number>
}): string {
  const weightedSymbols = Object.entries(slotConfig.symbolWeights).flatMap(
    ([symbol, weight]) => Array(weight).fill(symbol)
  )
  const spin = () =>
    weightedSymbols[Math.floor(Math.random() * weightedSymbols.length)]

  return spin() + spin() + spin()
}

export function rollDice() {
  return Math.floor(Math.random() * 6) + 1
}

export function flipCoin() {
  return Math.random() < 0.5 ? 'heads' : 'tails'
}

export function drawLottery() {
  return Array.from({ length: 50 }, (_, i) => i + 1)
    .sort(() => Math.random() - 0.5)
    .slice(0, 5)
}

export function drawGoldenJackpot(goldenJackpotConfig: {
  oneInChance: number
}) {
  return Math.floor(Math.random() * goldenJackpotConfig.oneInChance) + 1
}

export function drawNextCard(deck: Card[], cardIndex: number): Card {
  if (cardIndex >= deck.length) {
    cardIndex = 0
  }

  return deck[cardIndex]
}
