import { Interaction, MessageFlags } from 'discord.js'

import { handleUnexpectedButtonError } from '@/errors'
import {
  deleteBlackjackGame,
  getBlackjackGameByBetId,
  getGuildConfigByGuildId,
  getUser,
  reserveCasinoBet,
  settleCasinoWinnings,
  updateBlackjackGame
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
import { collectBlackjackBigWinLines } from '@/utils/casino/blackjackBigWin'
import { createErrorEmbed } from '@/utils/discord/createEmbed'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

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
    const guildConfig = await getGuildConfigByGuildId({ guildId })
    const globalSettings = guildConfig?.globalSettings

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
        embeds: [createErrorEmbed('Invalid Input', 'This is not your game.')],
        flags: MessageFlags.Ephemeral
      })
    }

    const engine = docToEngine(game)

    if (engine.phase !== 'PLAYER') {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
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

      try {
        await reserveCasinoBet({
          userId: game.userId,
          guildId,
          totalBet: extraBet,
          betId
        })
      } catch {
        return interaction.followUp({
          embeds: [
            createErrorEmbed(
              'Insufficient Funds',
              `You don't have enough funds to double.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      activeHand.betAmount += extraBet
    }

    if (action === 'SPLIT') {
      const splitBet = activeHand.betAmount

      try {
        await reserveCasinoBet({
          userId: game.userId,
          guildId,
          totalBet: splitBet,
          betId
        })
      } catch {
        return interaction.followUp({
          embeds: [
            createErrorEmbed(
              'Insufficient Funds',
              `You don't have enough funds to split.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }
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
              result: { kind: 'FINAL', finalResultId, netProfit: net },
              globalSettings
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
            result: { kind: 'PHASE', gamePhaseId: 'DEALER_DRAWING' },
            globalSettings
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
              result: { kind: 'PHASE', gamePhaseId: 'DEALER_DRAWING' },
              globalSettings
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

      await settleCasinoWinnings({
        userId: game.userId,
        guildId,
        totalBet,
        winnings: totalPayout,
        betId
      })

      if (guildConfig) {
        tryAnnounceBigWin({
          guild: interaction.guild,
          guildConfig,
          userId: game.userId,
          title: '🃏 Blackjack Big Win!',
          intro: 'crushed the table!',
          lines: collectBlackjackBigWinLines({
            engine,
            globalSettings,
            minMultiplier:
              guildConfig.casinoSettings.winAnnouncements.blackjackMinMultiplier
          }),
          betId,
          sourceChannelId: interaction.channelId
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
            result: { kind: 'FINAL', finalResultId, netProfit: net },
            globalSettings
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
          dealerHideSecondCard: true,
          globalSettings
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
    await handleUnexpectedButtonError(interaction, err, {
      handler: 'handleBlackjack'
    })
  }
}
