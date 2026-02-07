import { Client, TextChannel } from 'discord.js'

import {
  createTransaction,
  deleteBlackjackGame,
  getAllOldBlackjackGames,
  updateBlackjackGame,
  updateUserBalance
} from '@/services'
import {
  FinalGameResultId,
  applyAction,
  dealerDrawOne,
  dealerShouldDraw,
  docToEngine,
  engineToDoc,
  renderBlackjackEmbed,
  resolveResult
} from '@/utils/casino/blackjack'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'

export const blackjackAutostandJob = async (client: Client) => {
  const oldGames = await getAllOldBlackjackGames(1) // older than 1 day

  for (const game of oldGames) {
    try {
      const guild = await client.guilds.fetch(game.guildId).catch(() => null)
      if (!guild) continue

      const channel = await guild.channels
        .fetch(game.channelId)
        .catch(() => null)
      if (!channel || !(channel instanceof TextChannel)) continue

      const message = await channel.messages
        .fetch(game.messageId)
        .catch(() => null)
      if (!message) continue

      await message.edit({ components: [] })

      const engine = docToEngine(game)
      applyAction(engine, 'STAND')

      const nextHandIndex = engine.hands.findIndex(
        (h, i) => i > engine.activeHandIndex && !h.finished
      )

      if (nextHandIndex !== -1) {
        engine.activeHandIndex = nextHandIndex
        engineToDoc(engine, game)
        await updateBlackjackGame(game)
        continue
      }

      engine.activeHandIndex = engine.hands.length - 1

      while (dealerShouldDraw(engine)) {
        dealerDrawOne(engine)
      }

      let totalPayout = 0
      for (let i = 0; i < engine.hands.length; i++) {
        const r = resolveResult(engine, i)
        if (r.finished) totalPayout += r.payout
      }

      const totalBet = engine.hands.reduce(
        (sum, hand) => sum + hand.betAmount,
        0
      )
      const net = totalPayout - totalBet

      let finalResultId: FinalGameResultId =
        totalPayout === 0 ? 'LOSS' : totalPayout === totalBet ? 'EVEN' : 'WIN'

      if (totalPayout > 0) {
        await createTransaction({
          userId: game.userId,
          guildId: game.guildId,
          amount: totalPayout,
          type: 'win',
          source: 'casino',
          betId: game.betId
        })

        await updateUserBalance({
          userId: game.userId,
          guildId: game.guildId,
          amount: totalPayout
        })
      }

      await message.edit({
        content: 'This game was inactive, so auto-stand was executed.',
        embeds: [
          renderBlackjackEmbed({
            userId: game.userId,
            guildId: game.guildId,
            betId: game.betId,
            hands: engine.hands,
            activeHandIndex: -1,
            dealerCards: engine.dealerCards,
            result: { kind: 'FINAL', finalResultId, netProfit: net },
            showBalance: false
          })
        ],
        components: []
      })

      await deleteBlackjackGame({
        userId: game.userId,
        guildId: game.guildId
      })

      logger.worker(
        `🃏 Auto-stand executed for ${game.betId} in guild ${game.guildId}`
      )

      await sleep(300)
    } catch (err) {
      logger.error(`Auto-stand failed for game ${game.betId}`, err)
    }
  }
}
