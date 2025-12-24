import { Client, TextChannel } from 'discord.js'

import {
  createTransaction,
  deleteBlackjackGame,
  getAllOldBlackjackGames,
  updateBlackjackGame
} from '@/services'
import {
  applyAction,
  dealerDrawOne,
  dealerShouldDraw,
  docToEngine,
  engineToDoc,
  renderBlackjackEmbed,
  resolveResult
} from '@/utils/casino/blackjack'
import { logger } from '@/utils/logger'

export default async (client: Client) => {
  logger.boot('⌛ Blackjack auto-stand worker started')

  setInterval(async () => {
    const oldGames = await getAllOldBlackjackGames(1) // 1 day

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
          if (r.finished) {
            totalPayout += r.payout
          }
        }

        if (totalPayout > 0) {
          await createTransaction({
            userId: game.userId,
            guildId: game.guildId,
            amount: totalPayout,
            type: 'win',
            source: 'casino',
            betId: game.betId
          })
        }

        await message.edit({
          embeds: [
            renderBlackjackEmbed({
              userId: game.userId,
              guildId: game.guildId,
              betId: game.betId,
              hands: engine.hands,
              activeHandIndex: engine.activeHandIndex,
              dealerCards: engine.dealerCards,
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
          `🃏 Auto-stand executed for ${game.betId} in guild: ${game.guildId}`
        )
      } catch (err) {
        logger.error('Auto-stand failed:', err)
      }
    }
  }, 60_000)
}
