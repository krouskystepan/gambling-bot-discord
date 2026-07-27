import type { TBlackjackGame } from 'gambling-bot-shared/blackjack'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'

import { deleteBlackjackGame, getUser, settleCasinoWinnings } from '@/services'
import { collectBlackjackBigWinLines } from '@/utils/casino/blackjackBigWin'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

import { dealerDrawOne, dealerShouldDraw, resolveResult } from './engine'
import { renderBlackjackEmbed } from './render'
import type { EngineState, FinalGameResultId } from './types'

type EditableMessage = { edit: (...args: never[]) => Promise<unknown> }
type AnnounceGuild = Parameters<typeof tryAnnounceBigWin>[0]['guild']

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

  await settleCasinoWinnings({
    userId: game.userId,
    guildId: game.guildId,
    totalBet,
    winnings: totalPayout,
    betId: game.betId,
    game: 'blackjack'
  })

  if (guildConfig) {
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
      betId: game.betId,
      sourceChannelId
    })
  }

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
          betId: game.betId,
          hands: engine.hands,
          activeHandIndex: -1,
          dealerCards: engine.dealerCards,
          showBalance,
          userBalance,
          result: { kind: 'FINAL', finalResultId, netProfit: net },
          globalSettings: guildConfig?.globalSettings
        })
      ],
      components: []
    } as never)
  }

  await deleteBlackjackGame({
    userId: game.userId,
    guildId: game.guildId
  })

  return { totalPayout, totalBet, net, finalResultId, userBalance }
}
