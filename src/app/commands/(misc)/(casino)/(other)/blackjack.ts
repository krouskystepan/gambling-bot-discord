import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  checkCasinoChannels,
  checkUserRegistration,
  getBlackjackGameByUserAndGuild,
  getUser,
  reserveCasinoBet,
  settleCasinoWinnings,
  upsertBlackjackGame
} from '@/services'
import {
  DECK,
  StartBlackjackResultId,
  calculateHandValue,
  renderBlackjackButtons,
  renderBlackjackEmbed,
  shuffleDeck
} from '@/utils/casino/blackjack'
import {
  checkValidBet,
  formatNumberToReadableString,
  generateId,
  parseReadableStringToNumber
} from '@/utils/common/utils'
import { createErrorEmbed } from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'blackjack',
  description: 'Start a game of blackjack. You can hit, stand, or double down.',
  options: [
    {
      name: 'bet',
      description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
      type: ApplicationCommandOptionType.String,
      required: true
    },
    {
      name: 'show-balance',
      description:
        'Displays the current balance (WARNING: VISIBLE TO EVERYONE)!',
      type: ApplicationCommandOptionType.Boolean,
      required: false
    }
  ],
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const user = await checkUserRegistration({ interaction })
    if (!user) return

    const configReply = await checkCasinoChannels(interaction)
    if (!configReply) return

    const existingGame = await getBlackjackGameByUserAndGuild({
      userId: interaction.user.id,
      guildId: interaction.guildId!
    })

    if (existingGame) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Blackjack Already Active',
            `You already have an active Blackjack game running! 🃏`
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const betAmount = interaction.options.getString('bet', true)
    const parsedBetAmount = parseReadableStringToNumber(betAmount)
    const showBalance = interaction.options.getBoolean('show-balance') || false

    const isBetValid = checkValidBet(
      interaction,
      parsedBetAmount,
      configReply.casinoSettings.blackjack.maxBet,
      configReply.casinoSettings.blackjack.minBet
    )

    if (!isBetValid) return

    await interaction.deferReply()

    const betId = generateId()

    try {
      await reserveCasinoBet({
        userId: user.userId,
        guildId: user.guildId,
        totalBet: parsedBetAmount,
        betId
      })
    } catch (err) {
      if (err instanceof Error && err.message === 'INSUFFICIENT_FUNDS') {
        const freshUser = await getUser({
          userId: user.userId,
          guildId: user.guildId
        })

        return await interaction.reply({
          embeds: [
            createErrorEmbed(
              'Insufficient Funds',
              `You don't have enough money to place this bet.\nYour current balance is **$${formatNumberToReadableString(freshUser?.balance ?? 0)}**.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }
      throw err
    }

    const shuffledDeck = shuffleDeck(DECK)
    const playerCards = [shuffledDeck[0], shuffledDeck[1]]
    const dealerCards = [shuffledDeck[2], shuffledDeck[3]]

    const playerHasBlackjack =
      playerCards.length === 2 && calculateHandValue(playerCards) === 21

    const dealerHasBlackjack =
      dealerCards.length === 2 && calculateHandValue(dealerCards) === 21

    if (playerHasBlackjack || dealerHasBlackjack) {
      let startResultId: StartBlackjackResultId
      let payout = 0

      if (playerHasBlackjack && dealerHasBlackjack) {
        startResultId = 'BBJ'
        payout = parsedBetAmount
      } else if (playerHasBlackjack) {
        startResultId = 'PBJ'
        payout = parsedBetAmount * 2.5
      } else {
        startResultId = 'DBJ'
        payout = 0
      }

      const finalBalance = await settleCasinoWinnings({
        userId: user.userId,
        guildId: user.guildId,
        totalBet: parsedBetAmount,
        winnings: payout,
        betId
      })

      const hands = [
        {
          cards: playerCards,
          betAmount: parsedBetAmount,
          finished: true,
          isSplitHand: false
        }
      ]

      return interaction.editReply({
        embeds: [
          renderBlackjackEmbed({
            userId: interaction.user.id,
            guildId: interaction.guildId!,
            betId,
            hands,
            activeHandIndex: -1,
            dealerCards,
            showBalance,
            userBalance: finalBalance,
            result: { kind: 'START', startResultId }
          })
        ]
      })
    }

    const message = await interaction.fetchReply()

    const hands = [
      {
        cards: playerCards,
        betAmount: parsedBetAmount,
        finished: false,
        isSplitHand: false
      }
    ]

    await upsertBlackjackGame({
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      messageId: message.id,
      betId,
      deck: shuffledDeck,
      deckIndex: 4,
      hands,
      activeHandIndex: 0,
      phase: 'PLAYER',
      dealerCards
    })

    const canSplit =
      playerCards.length === 2 && playerCards[0].label === playerCards[1].label

    const row = renderBlackjackButtons({
      betId,
      showBalance,
      canDouble: true,
      canSplit
    })

    await interaction.editReply({
      embeds: [
        renderBlackjackEmbed({
          userId: interaction.user.id,
          guildId: interaction.guildId!,
          betId,
          hands,
          activeHandIndex: 0,
          result: { kind: 'PHASE', gamePhaseId: 'PLAYER_TURN' },
          dealerCards,
          showBalance,
          dealerHideSecondCard: true
        })
      ],
      components: [row]
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
