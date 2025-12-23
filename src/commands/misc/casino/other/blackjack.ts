import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  checkCasinoChannels,
  checkUserRegistration,
  createTransaction,
  getBlackjackGameByUserAndGuild,
  updateUserBalance,
  upsertBlackjackGame
} from '@/services'
import { DECK, shuffleDeck } from '@/utils/casino/blackjack/deck'
import { calculateHandValue } from '@/utils/casino/blackjack/math'
import {
  renderBlackjackButtons,
  renderBlackjackEmbed
} from '@/utils/casino/blackjack/render'
import {
  checkValidBet,
  generateBetId,
  parseReadableStringToNumber
} from '@/utils/common/utils'
import { createErrorEmbed } from '@/utils/discord/createEmbed'

export const data: CommandData = {
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

export const options: CommandOptions = {
  deleted: false
}

export async function run({ interaction }: SlashCommandProps) {
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
      configReply.casinoSettings.blackjack.minBet,
      user.balance
    )

    if (!isBetValid) return

    await interaction.deferReply()

    const betId = generateBetId()

    await updateUserBalance({
      userId: user.userId,
      guildId: user.guildId,
      amount: -parsedBetAmount,
      lockedAmount: -Math.min(user.lockedBalance, parsedBetAmount)
    })

    await createTransaction({
      userId: user.userId,
      guildId: user.guildId,
      amount: parsedBetAmount,
      type: 'bet',
      source: 'casino',
      betId
    })

    const shuffledDeck = shuffleDeck(DECK)
    const playerCards = [shuffledDeck[0], shuffledDeck[1]]
    const dealerCards = [shuffledDeck[2], shuffledDeck[3]]

    const playerHasBlackjack =
      playerCards.length === 2 && calculateHandValue(playerCards) === 21

    const dealerHasBlackjack =
      dealerCards.length === 2 && calculateHandValue(dealerCards) === 21

    if (playerHasBlackjack || dealerHasBlackjack) {
      let resultId: 'PBJ' | 'DBJ' | 'BBJ'
      let payout = 0

      if (playerHasBlackjack && dealerHasBlackjack) {
        resultId = 'BBJ'
        payout = parsedBetAmount
      } else if (playerHasBlackjack) {
        resultId = 'PBJ'
        payout = parsedBetAmount * 2.5
      } else {
        resultId = 'DBJ'
        payout = 0
      }

      let finalBalance = user.balance - parsedBetAmount

      if (payout > 0) {
        const updatedUser = await updateUserBalance({
          userId: user.userId,
          guildId: user.guildId,
          amount: payout
        })

        if (updatedUser) {
          await createTransaction({
            userId: user.userId,
            guildId: user.guildId,
            amount: payout,
            type: 'win',
            source: 'casino',
            betId
          })

          finalBalance = updatedUser.balance
        }
      }

      return interaction.editReply({
        embeds: [
          renderBlackjackEmbed({
            userId: interaction.user.id,
            guildId: interaction.guildId!,
            betId,
            betAmount: parsedBetAmount,
            playerCards,
            dealerCards,
            showBalance,
            userBalance: finalBalance,
            resultId
          })
        ]
      })
    }

    const message = await interaction.fetchReply()

    await upsertBlackjackGame({
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      messageId: message.id,
      betId,
      betAmount: parsedBetAmount,
      deck: shuffledDeck,
      deckIndex: 4,
      playerCards,
      dealerCards
    })

    // TODO: Add logic check for can split
    const row = renderBlackjackButtons({
      betId,
      showBalance,
      canDouble: true,
      canSplit: false
    })

    await interaction.editReply({
      embeds: [
        renderBlackjackEmbed({
          userId: interaction.user.id,
          guildId: interaction.guildId!,
          betId,
          betAmount: parsedBetAmount,
          playerCards,
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
