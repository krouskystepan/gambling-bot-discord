import { Interaction, MessageFlags } from 'discord.js'

import {
  createTransaction,
  deleteBlackjackGame,
  getBlackjackGameByBetId,
  getUser,
  updateBlackjackGame,
  updateUserBalanceAtomic
} from '@/services'
import {
  applyAction,
  calculateHandValue,
  canSplit,
  dealerDrawOne,
  dealerShouldDraw,
  decodeId,
  docToEngine,
  engineToDoc,
  renderBlackjackButtons,
  renderBlackjackEmbed,
  resolveResult
} from '@/utils/casino/blackjack'
import { createErrorEmbed, createInfoEmbed } from '@/utils/discord/createEmbed'
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
    const game = await getBlackjackGameByBetId({ betId, guildId })

    if (!game) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Invalid Game',
            'This game no longer exists.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (interaction.user.id !== game.userId) {
      return interaction.reply({
        embeds: [createInfoEmbed('Invalid Input', 'This is not your game.')],
        flags: MessageFlags.Ephemeral
      })
    }

    const engine = docToEngine(game)

    if (engine.phase !== 'PLAYER') {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Game not active',
            'This Blackjack game is no longer accepting actions.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    await interaction.deferUpdate()
    const activeHand = engine.hands[engine.activeHandIndex]

    if (action === 'DOUBLE') {
      const extraBet = activeHand.betAmount

      const updatedUser = await updateUserBalanceAtomic({
        userId: game.userId,
        guildId,
        balanceDelta: -extraBet,
        requireAvailableGte: extraBet
      })

      if (!updatedUser) {
        return interaction.followUp({
          embeds: [
            createInfoEmbed(
              'Insufficient Funds',
              `You don't have enough balance to double.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      await createTransaction({
        userId: game.userId,
        guildId,
        amount: extraBet,
        type: 'bet',
        source: 'casino',
        betId
      })

      activeHand.betAmount += extraBet
    }

    if (action === 'SPLIT') {
      const splitBet = activeHand.betAmount

      const updatedUser = await updateUserBalanceAtomic({
        userId: game.userId,
        guildId,
        balanceDelta: -splitBet,
        requireAvailableGte: splitBet
      })

      if (!updatedUser) {
        return interaction.followUp({
          embeds: [
            createInfoEmbed(
              'Insufficient Funds',
              `You don't have enough balance to split.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      await createTransaction({
        userId: game.userId,
        guildId,
        amount: splitBet,
        type: 'bet',
        source: 'casino',
        betId
      })
    }

    applyAction(engine, action)

    const value = calculateHandValue(activeHand.cards)

    if (value > 21) {
      activeHand.finished = true
    }

    if (action === 'HIT' && value === 21) {
      activeHand.finished = true
    }

    if (action === 'STAND' || action === 'DOUBLE') {
      activeHand.finished = true
    }

    if (activeHand.finished) {
      const nextHandIndex = engine.hands.findIndex(
        (h, i) => i > engine.activeHandIndex && !h.finished
      )

      if (nextHandIndex !== -1) {
        engine.activeHandIndex = nextHandIndex
      } else {
        engine.phase = 'DEALER'
      }
    }

    if (engine.phase === 'DEALER') {
      const allPlayerHandsBusted = engine.hands.every(
        (h) => calculateHandValue(h.cards) > 21
      )

      if (allPlayerHandsBusted) {
        let totalPayout = 0
        for (let i = 0; i < engine.hands.length; i++) {
          const r = resolveResult(engine, i)
          if (r.finished) totalPayout += r.payout
        }

        const totalBet = engine.hands.reduce((s, h) => s + h.betAmount, 0)
        const net = totalPayout - totalBet
        const finalResultId = net > 0 ? 'WIN' : net < 0 ? 'LOSS' : 'EVEN'

        const finalUser = await getUser({ userId: game.userId, guildId })
        if (!finalUser) return

        await interaction.message.edit({
          embeds: [
            renderBlackjackEmbed({
              userId: game.userId,
              guildId,
              betId,
              hands: engine.hands,
              activeHandIndex: -1,
              dealerCards: engine.dealerCards,
              showBalance,
              userBalance: finalUser.balance,
              result: { kind: 'FINAL', finalResultId, netProfit: net }
            })
          ],
          components: []
        })

        await deleteBlackjackGame({ userId: game.userId, guildId })
        return
      }

      engineToDoc(engine, game)
      await updateBlackjackGame(game)

      await interaction.message.edit({
        embeds: [
          renderBlackjackEmbed({
            userId: game.userId,
            guildId,
            betId,
            hands: engine.hands,
            activeHandIndex: -1,
            dealerCards: engine.dealerCards,
            showBalance,
            result: { kind: 'PHASE', gamePhaseId: 'DEALER_DRAWING' }
          })
        ],
        components: []
      })

      while (dealerShouldDraw(engine)) {
        await sleep(700)
        dealerDrawOne(engine)

        await interaction.message.edit({
          embeds: [
            renderBlackjackEmbed({
              userId: game.userId,
              guildId,
              betId,
              hands: engine.hands,
              activeHandIndex: -1,
              dealerCards: engine.dealerCards,
              showBalance,
              result: { kind: 'PHASE', gamePhaseId: 'DEALER_DRAWING' }
            })
          ],
          components: []
        })
      }

      let totalPayout = 0
      for (let i = 0; i < engine.hands.length; i++) {
        const r = resolveResult(engine, i)
        if (r.finished) totalPayout += r.payout
      }

      const totalBet = engine.hands.reduce((s, h) => s + h.betAmount, 0)
      const net = totalPayout - totalBet

      const finalResultId = net > 0 ? 'WIN' : net < 0 ? 'LOSS' : 'EVEN'

      if (totalPayout > 0) {
        await createTransaction({
          userId: game.userId,
          guildId,
          amount: totalPayout,
          type: 'win',
          source: 'casino',
          betId
        })

        await updateUserBalanceAtomic({
          userId: game.userId,
          guildId,
          balanceDelta: totalPayout,
          lockedDelta: -totalBet
        })
      }

      let userBalance: number | undefined

      if (showBalance) {
        const user = await getUser({ userId: game.userId, guildId })
        if (user) userBalance = user.balance
      }

      await interaction.message.edit({
        embeds: [
          renderBlackjackEmbed({
            userId: game.userId,
            guildId,
            betId,
            hands: engine.hands,
            activeHandIndex: -1,
            dealerCards: engine.dealerCards,
            showBalance,
            userBalance,
            result: { kind: 'FINAL', finalResultId, netProfit: net }
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

    engineToDoc(engine, game)
    await updateBlackjackGame(game)

    const hand = engine.hands[engine.activeHandIndex]

    await interaction.message.edit({
      embeds: [
        renderBlackjackEmbed({
          userId: game.userId,
          guildId,
          betId,
          hands: engine.hands,
          activeHandIndex: engine.activeHandIndex,
          dealerCards: engine.dealerCards,
          showBalance,
          result: { kind: 'PHASE', gamePhaseId: 'PLAYER_TURN' },
          dealerHideSecondCard: true
        })
      ],
      components: [
        renderBlackjackButtons({
          betId,
          showBalance,
          canDouble: hand.cards.length === 2,
          canSplit: canSplit(engine)
        })
      ]
    })
  } catch (err) {
    logger.error('Blackjack button error', err)
  }
}
