import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} from 'discord.js'

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
import {
  BJResults,
  DECK,
  calculateHandValue,
  createBlackjackEmbed,
  shuffleDeck
} from '@/utils/blackjackUtils'
import { drawNextCard } from '@/utils/casinoHelpers'
import { createErrorEmbed } from '@/utils/createEmbed'
import {
  checkValidBet,
  formatNumberToReadableString,
  generateBetId,
  parseReadableStringToNumber
} from '@/utils/utils'

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
    const readableBetAmount = formatNumberToReadableString(parsedBetAmount)
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
    const playerCards = [
      drawNextCard(shuffledDeck, 0),
      drawNextCard(shuffledDeck, 1)
    ]
    const dealerCards = [
      drawNextCard(shuffledDeck, 2),
      drawNextCard(shuffledDeck, 3)
    ]

    const playerTotal = calculateHandValue(playerCards)
    const dealerTotal = calculateHandValue(dealerCards)

    const playerHasBlackjack = playerCards.length === 2 && playerTotal === 21
    const dealerHasBlackjack = dealerCards.length === 2 && dealerTotal === 21

    let resultId: BJResults

    if (playerHasBlackjack || dealerHasBlackjack) {
      let balanceIncrement = 0

      if (playerHasBlackjack && dealerHasBlackjack) {
        resultId = 'BBJ'
        balanceIncrement = parsedBetAmount
      } else if (playerHasBlackjack) {
        resultId = 'PBJ'
        balanceIncrement = parsedBetAmount * 2.5
      } else if (dealerHasBlackjack) {
        resultId = 'DBJ'
        balanceIncrement = 0
      }

      let finalBalance = user.balance - parsedBetAmount

      if (balanceIncrement > 0) {
        const updatedUser = await updateUserBalance({
          userId: user.userId,
          guildId: user.guildId,
          amount: balanceIncrement
        })

        if (!updatedUser) {
          throw new Error('User not found when paying out Blackjack')
        }

        await createTransaction({
          userId: user.userId,
          guildId: user.guildId,
          amount: balanceIncrement,
          type: 'win',
          source: 'casino',
          betId
        })

        finalBalance = updatedUser.balance
      }

      return interaction.editReply({
        embeds: [
          createBlackjackEmbed(
            readableBetAmount,
            dealerCards,
            dealerTotal,
            playerCards,
            playerTotal,
            resultId!,
            showBalance,
            finalBalance,
            betId
          )
        ]
      })
    }

    const message = await interaction.fetchReply()

    await upsertBlackjackGame({
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      gameId: message.id,
      betAmount: parsedBetAmount,
      deck: shuffledDeck,
      playerCards,
      dealerCards
    })

    const hitButton = new ButtonBuilder()
      .setCustomId(
        `blackjack.${message.id}-${interaction.user.id}-${interaction.guildId}-${betId}.hit.${showBalance}`
      )
      .setLabel('Hit')
      .setStyle(ButtonStyle.Success)

    const standButton = new ButtonBuilder()
      .setCustomId(
        `blackjack.${message.id}-${interaction.user.id}-${interaction.guildId}-${betId}.stand.${showBalance}`
      )
      .setLabel('Stand')
      .setStyle(ButtonStyle.Danger)

    const doubleButton = new ButtonBuilder()
      .setCustomId(
        `blackjack.${message.id}-${interaction.user.id}-${interaction.guildId}-${betId}.double.${showBalance}`
      )
      .setLabel('Double')
      .setStyle(ButtonStyle.Primary)

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      hitButton,
      standButton,
      doubleButton
    )

    interaction.editReply({
      embeds: [
        createBlackjackEmbed(
          readableBetAmount,
          dealerCards,
          dealerTotal,
          playerCards,
          playerTotal,
          undefined,
          false,
          0,
          betId,
          true
        )
      ],
      components: [row]
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
