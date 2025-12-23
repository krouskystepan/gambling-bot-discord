import { Interaction, MessageFlags } from 'discord.js'

import {
  consumeUserBalance,
  createTransaction,
  deleteBlackjackGame,
  getBlackjackGameByBetId,
  updateBlackjackGame
} from '@/services'
import { decodeId } from '@/utils/casino/blackjack/customId'
import {
  applyAction,
  dealerDrawOne,
  dealerShouldDraw,
  resolveResult
} from '@/utils/casino/blackjack/engine'
import {
  renderBlackjackButtons,
  renderBlackjackEmbed
} from '@/utils/casino/blackjack/render'
import { docToEngine, engineToDoc } from '@/utils/casino/blackjack/state'
import { logger } from '@/utils/logger'

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

export default async (interaction: Interaction) => {
  if (!interaction.isButton()) return

  const data = decodeId(interaction.customId)

  if (!data) return

  const { betId, action, showBalance } = data

  const guildId = interaction.guildId
  if (!guildId) return

  try {
    // TODO: Enhance the errors
    const game = await getBlackjackGameByBetId({
      betId,
      guildId
    })

    if (!game) {
      return interaction.reply({
        content: 'This game no longer exists.',
        flags: MessageFlags.Ephemeral
      })
    }

    // TODO: Delete this in prod.
    if (action === 'DEV-DELETE') {
      const engine = docToEngine(game)

      deleteBlackjackGame({
        userId: game.userId,
        guildId
      })

      await interaction.message.edit({
        embeds: [
          renderBlackjackEmbed({
            userId: game.userId,
            guildId,
            betId,
            betAmount: engine.betAmount,
            playerCards: engine.playerCards,
            dealerCards: engine.dealerCards,
            showBalance,
            dealerHideSecondCard: false
          })
        ],
        components: []
      })

      return interaction.reply({
        content: 'Game Removed. DEV ONLY!',
        flags: MessageFlags.Ephemeral
      })
    }

    if (interaction.user.id !== game.userId) {
      return interaction.reply({
        content: 'This is not your game.',
        flags: MessageFlags.Ephemeral
      })
    }

    await interaction.deferUpdate()

    const engine = docToEngine(game)

    if (action === 'DOUBLE') {
      const user = await consumeUserBalance({
        userId: game.userId,
        guildId,
        amount: engine.betAmount
      })

      if (!user) {
        return interaction.followUp({
          content: `You don't have enough balance to double.`,
          flags: MessageFlags.Ephemeral
        })
      }

      await createTransaction({
        userId: game.userId,
        guildId,
        amount: engine.betAmount,
        type: 'bet',
        source: 'casino',
        betId
      })
    }

    const result = applyAction(engine, action)

    if (!result.finished && 'dealerTurn' in result) {
      await interaction.message.edit({
        embeds: [
          renderBlackjackEmbed({
            userId: game.userId,
            guildId,
            betId,
            betAmount: engine.betAmount,
            playerCards: engine.playerCards,
            dealerCards: engine.dealerCards,
            showBalance,
            dealerHideSecondCard: false
          })
        ],
        components: []
      })

      engineToDoc(engine, game)
      await updateBlackjackGame(game)
      while (dealerShouldDraw(engine)) {
        await sleep(700)

        dealerDrawOne(engine)

        await interaction.message.edit({
          embeds: [
            renderBlackjackEmbed({
              userId: game.userId,
              guildId,
              betId,
              betAmount: engine.betAmount,
              playerCards: engine.playerCards,
              dealerCards: engine.dealerCards,
              showBalance,
              dealerHideSecondCard: false
            })
          ],
          components: []
        })
      }

      const finalResult = resolveResult(engine)

      if (finalResult.finished && finalResult.payout > 0) {
        await createTransaction({
          userId: game.userId,
          guildId,
          amount: finalResult.payout,
          type: 'win',
          source: 'casino',
          betId
        })
      }

      if (finalResult.finished) {
        await interaction.message.edit({
          embeds: [
            renderBlackjackEmbed({
              userId: game.userId,
              guildId,
              betId,
              betAmount: engine.betAmount,
              playerCards: engine.playerCards,
              dealerCards: engine.dealerCards,
              showBalance,
              resultId: finalResult.resultId
            })
          ],
          components: []
        })
      }

      await deleteBlackjackGame({
        userId: game.userId,
        guildId
      })

      return
    }

    if (result.finished) {
      if (result.payout > 0) {
        await createTransaction({
          userId: game.userId,
          guildId,
          amount: result.payout,
          type: 'win',
          source: 'casino',
          betId
        })
      }

      await interaction.message.edit({
        embeds: [
          renderBlackjackEmbed({
            userId: game.userId,
            guildId,
            betId,
            betAmount: engine.betAmount,
            playerCards: engine.playerCards,
            dealerCards: engine.dealerCards,
            showBalance,
            userBalance: undefined,
            resultId: result.resultId
          })
        ],
        components: []
      })

      await deleteBlackjackGame({
        userId: game.userId,
        guildId
      })

      return
    }

    // 7️⃣ Persist ongoing game
    engineToDoc(engine, game)
    await updateBlackjackGame(game)

    // 8️⃣ Render ongoing state
    await interaction.message.edit({
      embeds: [
        renderBlackjackEmbed({
          userId: game.userId,
          guildId,
          betId,
          betAmount: engine.betAmount,
          playerCards: engine.playerCards,
          dealerCards: engine.dealerCards,
          showBalance,
          dealerHideSecondCard: true
        })
      ],
      components: [
        renderBlackjackButtons({
          betId,
          showBalance,
          canDouble: engine.playerCards.length === 2,
          canSplit: false
        })
      ]
    })
  } catch (err) {
    logger.error('Blackjack button error', err)
  }
}
