import type { TBlackjackGame } from 'gambling-bot-shared/blackjack'
import { bumpSessionStats } from 'gambling-bot-shared/casino'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'

import { getUser, settleCasinoWinnings, updateBlackjackGame } from '@/services'
import { collectBlackjackBigWinLines } from '@/utils/casino/blackjackBigWin'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

import { dealerDrawOne, dealerShouldDraw, resolveResult } from './engine'
import { renderBlackjackEmbed, renderBlackjackResultComponents } from './render'
import type { EngineState, FinalGameResultId } from './types'

type EditableMessage = { edit: (...args: never[]) => Promise<unknown> }
type AnnounceGuild = Parameters<typeof tryAnnounceBigWin>[0]['guild']

/**
 * Finishes the dealer hand, settles the active round and parks the session in
 * `RESULT` so the player can rebet, change the stake, or close it.
 */
export const finishBlackjackDealerAndSettle = async ({
  game,
  engine,
  guildConfig,
  guild,
  sourceChannelId,
  showBalance,
  message,
  finalMessageContent,
  persistProgress
}: {
  game: TBlackjackGame
  engine: EngineState
  guildConfig?: TGuildConfiguration | null
  guild: AnnounceGuild
  sourceChannelId: string
  showBalance: boolean
  message?: EditableMessage | null
  finalMessageContent?: string
  persistProgress?: () => Promise<void>
}) => {
  while (dealerShouldDraw(engine)) {
    dealerDrawOne(engine)
    if (persistProgress) {
      await persistProgress()
    }
  }

  const winMultipliers = guildConfig?.casinoSettings.blackjack.winMultipliers
  let totalPayout = 0
  for (let i = 0; i < engine.hands.length; i++) {
    const r = resolveResult(engine, i, winMultipliers)
    if (r.finished) totalPayout += r.payout
  }

  const totalBet = engine.hands.reduce((sum, hand) => sum + hand.betAmount, 0)
  const net = totalPayout - totalBet
  const finalResultId: FinalGameResultId =
    totalPayout === 0 ? 'LOSS' : totalPayout === totalBet ? 'EVEN' : 'WIN'

  const betId = game.activeBetId
  const sessionStats = betId
    ? bumpSessionStats(game.sessionStats, { totalBet, totalPayout })
    : game.sessionStats

  if (betId) {
    await settleCasinoWinnings({
      userId: game.userId,
      guildId: game.guildId,
      totalBet,
      winnings: totalPayout,
      betId,
      game: 'blackjack',
      rounds: 1
    })
  }

  if (guildConfig && betId) {
    tryAnnounceBigWin({
      guild,
      guildConfig,
      game: 'blackjack',
      lines: collectBlackjackBigWinLines({
        engine,
        globalSettings: guildConfig.globalSettings,
        winMultipliers,
        minMultiplier:
          guildConfig.casinoSettings.winAnnouncements.blackjackMinMultiplier
      }),
      betId: game.gameId,
      sourceChannelId
    })
  }

  await updateBlackjackGame({
    userId: game.userId,
    guildId: game.guildId,
    phase: 'RESULT',
    activeBetId: null,
    deck: engine.deck,
    deckIndex: engine.deckIndex,
    hands: engine.hands,
    activeHandIndex: -1,
    dealerCards: engine.dealerCards,
    sessionStats
  })

  let userBalance: number | undefined
  if (showBalance) {
    const user = await getUser({ userId: game.userId, guildId: game.guildId })
    if (user) userBalance = user.balance
  }

  if (message) {
    await message.edit({
      content: finalMessageContent,
      embeds: [
        renderBlackjackEmbed({
          userId: game.userId,
          guildId: game.guildId,
          gameId: game.gameId,
          hands: engine.hands,
          activeHandIndex: -1,
          dealerCards: engine.dealerCards,
          showBalance,
          userBalance,
          result: { kind: 'FINAL', finalResultId, netProfit: net },
          globalSettings: guildConfig?.globalSettings
        })
      ],
      components: renderBlackjackResultComponents({
        gameId: game.gameId,
        showBalance
      })
    } as never)
  }

  return {
    totalPayout,
    totalBet,
    net,
    finalResultId,
    userBalance,
    sessionStats
  }
}
