import {
  USER_BANNED_ERROR,
  USER_BANNED_MESSAGE
} from 'gambling-bot-shared/user'

import { Interaction, MessageFlags } from 'discord.js'

import { handleUnexpectedButtonError } from '@/errors'
import {
  getBlackjackGameByBetId,
  getGuildConfigByGuildId,
  reserveCasinoBet,
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
  finishBlackjackDealerAndSettle,
  renderBlackjackButtons,
  renderBlackjackEmbed
} from '@/utils/casino/blackjack'
import { createErrorEmbed } from '@/utils/discord/createEmbed'

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
          betId,
          game: 'blackjack'
        })
      } catch (error) {
        if (error instanceof Error && error.message === USER_BANNED_ERROR) {
          return interaction.followUp({
            embeds: [
              createErrorEmbed('Account Restricted', USER_BANNED_MESSAGE)
            ],
            flags: MessageFlags.Ephemeral
          })
        }

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
          betId,
          game: 'blackjack'
        })
      } catch (error) {
        if (error instanceof Error && error.message === USER_BANNED_ERROR) {
          return interaction.followUp({
            embeds: [
              createErrorEmbed('Account Restricted', USER_BANNED_MESSAGE)
            ],
            flags: MessageFlags.Ephemeral
          })
        }

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
        await finishBlackjackDealerAndSettle({
          game,
          engine,
          guildConfig,
          guild: interaction.guild,
          sourceChannelId: interaction.channelId,
          showBalance,
          message: interaction.message
        })
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
      }

      await finishBlackjackDealerAndSettle({
        game,
        engine,
        guildConfig,
        guild: interaction.guild,
        sourceChannelId: interaction.channelId,
        showBalance,
        message: interaction.message
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
