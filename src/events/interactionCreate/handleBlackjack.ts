import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Interaction,
  MessageFlags,
} from 'discord.js'
import { createErrorEmbed, createInfoEmbed } from '../../utils/createEmbed'
import BlackjackGame from '../../models/BlackjackGame'
import { drawNextCard } from '../../utils/casinoHelpers'
import {
  calculateHandValue,
  createBlackjackEmbed,
  revealDealerCards,
} from '../../utils/blackjackUtils'
import { formatNumberToReadableString } from '../../utils/utils'
import User from '../../models/User'

export default async (interaction: Interaction, client: Client) => {
  if (!interaction.isButton() || !interaction.customId) return

  try {
    const [type, ids, action] = interaction.customId.split('.')
    const [gameId, userId, guildId] = ids.split('-')

    if (!type || !ids || !action) return
    if (type !== 'blackjack') return
    if (!gameId || !userId || !guildId) return

    if (userId !== interaction.user.id) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Wrong user',
            'This is not your game.\nStart your own with `/blackjack`.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const game = await BlackjackGame.findOne({ userId, guildId, gameId })

    if (!game) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Game not found',
            'You do not have an active game.\nStart one with `/blackjack`.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const message = await interaction.channel?.messages.fetch(gameId)

    if (!message) {
      await BlackjackGame.findOneAndDelete({ userId, guildId, gameId })

      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Message not found',
            'The message for this game was not found.\nStart a new game with `/blackjack`.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
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

      const user = await User.findOne({ userId, guildId })

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
        gameId
      )

      return interaction.followUp({
        content: 'You have stood.',
        flags: MessageFlags.Ephemeral,
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
          .setCustomId(`blackjack.${gameId}-${userId}-${guildId}.hit`)
          .setLabel('Hit')
          .setStyle(ButtonStyle.Success)

        const standButton = new ButtonBuilder()
          .setCustomId(`blackjack.${gameId}-${userId}-${guildId}.stand`)
          .setLabel('Stand')
          .setStyle(ButtonStyle.Danger)

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          hitButton,
          standButton
        )

        await message.edit({
          components: [row],
        })
      }

      const drawnCard = drawNextCard(game.deck, gameIndex)

      game.playerCards.push(drawnCard)

      playerTotal = calculateHandValue(game.playerCards)

      const user = await User.findOne({ userId, guildId })

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
              'PB'
            ),
          ],
          components: [],
        })

        await BlackjackGame.findOneAndDelete({ userId, guildId, gameId })

        return interaction.followUp({
          content: 'You have busted.',
          flags: MessageFlags.Ephemeral,
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
          gameId
        )

        await BlackjackGame.findOneAndDelete({ userId, guildId, gameId })

        return interaction.followUp({
          content: 'You have hit.',
          flags: MessageFlags.Ephemeral,
        })
      }

      await BlackjackGame.findOneAndUpdate(
        { userId, guildId, gameId },
        { playerCards: game.playerCards, deck: game.deck }
      )

      await message.edit({
        embeds: [
          createBlackjackEmbed(
            formatNumberToReadableString(game.betAmount),
            dealerCards,
            dealerTotal,
            game.playerCards,
            playerTotal,
            undefined,
            true
          ),
        ],
      })

      return interaction.followUp({
        content: 'You have hit.',
        flags: MessageFlags.Ephemeral,
      })
    }

    if (action === 'double') {
      await interaction.deferUpdate()

      const dealerCards = [...game.dealerCards]
      const dealerTotal = calculateHandValue(dealerCards)

      let playerTotal = calculateHandValue(game.playerCards)

      let gameIndex = game.dealerCards.length + game.playerCards.length

      const user = await User.findOne({ userId, guildId })

      const betAmount = game.betAmount * 2

      if (!user) return

      if (betAmount > user.balance) {
        return interaction.followUp({
          embeds: [
            createInfoEmbed(
              'Insufficient balance',
              `You don't have enough money to place this bet.\nYour current balance is **$${formatNumberToReadableString(
                user.balance
              )}**.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const drawnCard = drawNextCard(game.deck, gameIndex)

      game.playerCards.push(drawnCard)

      playerTotal = calculateHandValue(game.playerCards)

      if (playerTotal > 21) {
        await BlackjackGame.findOneAndDelete({ userId, guildId, gameId })

        await message.edit({
          embeds: [
            createBlackjackEmbed(
              formatNumberToReadableString(betAmount),
              dealerCards,
              dealerTotal,
              game.playerCards,
              playerTotal,
              'PB'
            ),
          ],
          components: [],
        })

        return interaction.followUp({
          content: 'You have busted.',
          flags: MessageFlags.Ephemeral,
        })
      }

      await revealDealerCards(
        formatNumberToReadableString(betAmount),
        message,
        dealerCards,
        dealerTotal,
        game.playerCards,
        playerTotal,
        game.deck,
        gameIndex + 1,
        user,
        guildId,
        gameId
      )

      return interaction.followUp({
        content: 'You have doubled down.',
        flags: MessageFlags.Ephemeral,
      })
    }
  } catch (error) {
    console.error('Error in handleBlackjack.ts', error)
  }
}
