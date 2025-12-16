import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Interaction,
  MessageFlags
} from 'discord.js'

import {
  consumeUserBalance,
  createTransaction,
  deleteBlackjackGame,
  getBlackjackGameByUserAndGuild,
  getUser,
  updateBlackjackGameState
} from '@/services'
import {
  calculateHandValue,
  createBlackjackEmbed,
  revealDealerCards
} from '@/utils/blackjackUtils'
import { drawNextCard } from '@/utils/casinoHelpers'
import { createErrorEmbed, createInfoEmbed } from '@/utils/createEmbed'
import { formatNumberToReadableString } from '@/utils/utils'

export default async (interaction: Interaction, _client: Client) => {
  if (!interaction.isButton() || !interaction.customId) return

  try {
    const [type, ids, action, showBalanceString] =
      interaction.customId.split('.')

    if (!type || !ids || !action) return

    const [gameId, userId, guildId, betId] = ids.split('-')

    if (type !== 'blackjack') return
    if (!gameId || !userId || !guildId || !betId) return

    const showBalance = showBalanceString === 'true'

    if (userId !== interaction.user.id) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Wrong user',
            'This is not your game.\nStart your own with `/blackjack`.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const game = await getBlackjackGameByUserAndGuild({
      guildId,
      userId
    })

    if (!game) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Game not found',
            'You do not have an active game.\nStart one with `/blackjack`.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const message = await interaction.channel?.messages.fetch(gameId)

    if (!message) {
      await deleteBlackjackGame({ guildId, userId })

      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Message not found',
            'The message for this game was not found.\nStart a new game with `/blackjack`.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (action === 'stand') {
      await interaction.deferUpdate()

      const deck = [...game.deck]

      let dealerCards = [...game.dealerCards]
      const playerCards = [...game.playerCards]

      let dealerTotal = calculateHandValue(dealerCards)
      const playerTotal = calculateHandValue(playerCards)

      let gameIndex = game.dealerCards.length + game.playerCards.length

      const user = await getUser({ userId, guildId })
      if (!user) return

      await revealDealerCards(
        formatNumberToReadableString(game.betAmount),
        message,
        dealerCards,
        dealerTotal,
        playerCards,
        playerTotal,
        deck,
        gameIndex,
        user,
        guildId,
        gameId,
        showBalance,
        betId
      )

      return interaction.followUp({
        content: 'You have stood.',
        flags: MessageFlags.Ephemeral
      })
    }

    if (action === 'hit') {
      await interaction.deferUpdate()

      const dealerCards = [...game.dealerCards]
      const dealerTotal = calculateHandValue(dealerCards)

      let playerTotal = calculateHandValue(game.playerCards)

      let gameIndex = game.dealerCards.length + game.playerCards.length

      if (game.playerCards.length <= 3) {
        const hitButton = new ButtonBuilder()
          .setCustomId(
            `blackjack.${gameId}-${userId}-${guildId}-${betId}.hit.${showBalance}`
          )
          .setLabel('Hit')
          .setStyle(ButtonStyle.Success)

        const standButton = new ButtonBuilder()
          .setCustomId(
            `blackjack.${gameId}-${userId}-${guildId}-${betId}.stand.${showBalance}`
          )
          .setLabel('Stand')
          .setStyle(ButtonStyle.Danger)

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          hitButton,
          standButton
        )

        await message.edit({
          components: [row]
        })
      }

      const drawnCard = drawNextCard(game.deck, gameIndex)

      game.playerCards.push(drawnCard)

      playerTotal = calculateHandValue(game.playerCards)

      const user = await getUser({ userId, guildId })
      if (!user) return

      if (playerTotal > 21) {
        await message.edit({
          embeds: [
            createBlackjackEmbed(
              formatNumberToReadableString(game.betAmount),
              dealerCards,
              dealerTotal,
              game.playerCards,
              playerTotal,
              'PB',
              showBalance,
              user.balance,
              betId
            )
          ],
          components: []
        })

        await deleteBlackjackGame({ userId, guildId })

        return interaction.followUp({
          content: 'You have busted.',
          flags: MessageFlags.Ephemeral
        })
      }

      if (playerTotal === 21) {
        await revealDealerCards(
          formatNumberToReadableString(game.betAmount),
          message,
          dealerCards,
          dealerTotal,
          game.playerCards,
          playerTotal,
          game.deck,
          gameIndex + 1,
          user,
          guildId,
          gameId,
          showBalance,
          betId
        )

        await deleteBlackjackGame({ userId, guildId })

        return interaction.followUp({
          content: 'You have hit.',
          flags: MessageFlags.Ephemeral
        })
      }

      await updateBlackjackGameState({
        userId,
        guildId,
        playerCards: game.playerCards,
        deck: game.deck
      })

      await message.edit({
        embeds: [
          createBlackjackEmbed(
            formatNumberToReadableString(game.betAmount),
            dealerCards,
            dealerTotal,
            game.playerCards,
            playerTotal,
            undefined,
            false,
            0,
            betId,
            true
          )
        ]
      })

      return interaction.followUp({
        content: 'You have hit.',
        flags: MessageFlags.Ephemeral
      })
    }

    if (action === 'double') {
      await interaction.deferUpdate()

      const dealerCards = [...game.dealerCards]
      const dealerTotal = calculateHandValue(dealerCards)

      let playerTotal = calculateHandValue(game.playerCards)
      let gameIndex = game.dealerCards.length + game.playerCards.length

      const additionalBet = game.betAmount

      const user = await consumeUserBalance({
        userId,
        guildId,
        amount: additionalBet
      })

      if (!user) {
        return interaction.followUp({
          embeds: [
            createInfoEmbed(
              'Insufficient balance',
              `You don't have enough money to place this bet.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      await createTransaction({
        userId: user.userId,
        guildId: user.guildId,
        amount: additionalBet,
        type: 'bet',
        source: 'casino',
        betId
      })

      const drawnCard = drawNextCard(game.deck, gameIndex)
      game.playerCards.push(drawnCard)
      playerTotal = calculateHandValue(game.playerCards)

      if (playerTotal > 21) {
        await deleteBlackjackGame({ userId, guildId })

        await message.edit({
          embeds: [
            createBlackjackEmbed(
              formatNumberToReadableString(additionalBet * 2),
              dealerCards,
              dealerTotal,
              game.playerCards,
              playerTotal,
              'PB',
              showBalance,
              user.balance,
              betId
            )
          ],
          components: []
        })

        return interaction.followUp({
          content: 'You have busted.',
          flags: MessageFlags.Ephemeral
        })
      }

      await revealDealerCards(
        formatNumberToReadableString(additionalBet * 2),
        message,
        dealerCards,
        dealerTotal,
        game.playerCards,
        playerTotal,
        game.deck,
        gameIndex + 1,
        user,
        guildId,
        gameId,
        showBalance,
        betId
      )

      return interaction.followUp({
        content: 'You have doubled down.',
        flags: MessageFlags.Ephemeral
      })
    }
  } catch (error) {
    console.error('Error in handleBlackjack.ts', error)
  }
}
