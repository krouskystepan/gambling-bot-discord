import {
  type BaccaratBetSide,
  isValidBaccaratBetSide
} from 'gambling-bot-shared/casino'

export type BaccaratButtonId = {
  betId: string
  side: BaccaratBetSide
  showBalance: boolean
  skipAnimations: boolean
}

export const encodeId = (d: BaccaratButtonId): string =>
  `bc:${d.betId}:${d.side}:${d.showBalance ? 1 : 0}:${d.skipAnimations ? 1 : 0}`

export const decodeId = (id: string): BaccaratButtonId | null => {
  if (!id.startsWith('bc:')) return null

  const parts = id.split(':')
  if (parts.length !== 5) return null

  const [, betId, sideRaw, showRaw, skipRaw] = parts
  if (!betId || !sideRaw || !isValidBaccaratBetSide(sideRaw)) return null

  return {
    betId,
    side: sideRaw,
    showBalance: showRaw === '1',
    skipAnimations: skipRaw === '1'
  }
}
