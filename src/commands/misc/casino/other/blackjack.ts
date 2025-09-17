import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js'
import { createErrorEmbed } from '../../../../utils/createEmbed'
import {
  shuffleDeck,
  DECK,
  calculateHandValue,
  createBlackjackEmbed,
  BJResults,
} from '../../../../utils/blackjackUtils'
import BlackjackGame from '../../../../models/BlackjackGame'
import { drawNextCard } from '../../../../utils/casinoHelpers'
import {
  checkUserRegistration,
  checkChannelConfiguration,
  parseReadableStringToNumber,
  formatNumberToReadableString,
  checkValidBet,
  generateBetId,
} from '../../../../utils/utils'
import Transaction from '../../../../models/Transaction'

export const data: CommandData = {
  name: 'blackjack',
  description: 'Start a game of blackjack. You can hit, stand, or double down.',
  options: [
    {
      name: 'bet',
      description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'show-balance',
      description:
        'Displays the current balance (WARNING: VISIBLE TO EVERYONE)!',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
  ],
  dm_permission: false,
}

export const options: CommandOptions = {
  deleted: false,
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    const user = await checkUserRegistration(
      interaction.user.id,
      interaction.guildId!
    )

    if (!user) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Not registered',
            'You are not registered yet.\nUse the `/register` command to register.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const configReply = await checkChannelConfiguration(
      interaction,
      'casinoChannelIds',
      {
        notSet:
          'This server has not been configured for betting commands yet.\nSet it up using web dashboard.',
        notAllowed: `This channel is not configured for betting commands.\nTry one of these channels:`,
      }
    )

    if (!configReply) return

    const existingGame = await BlackjackGame.findOne({
      guildId: interaction.guild?.id,
      userId: interaction.user.id,
    })

    if (existingGame) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Blackjack Already Active',
            `You already have an active Blackjack game running! 🃏`
          ),
        ],
        flags: MessageFlags.Ephemeral,
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

    user.balance -= parsedBetAmount
    await user.save()

    await Transaction.create({
      userId: user.userId,
      guildId: user.guildId,
      amount: parsedBetAmount,
      type: 'bet',
      source: 'casino',
      betId,
      createdAt: new Date(),
    })

    const shuffledDeck = shuffleDeck(DECK)
    const playerCards = [
      drawNextCard(shuffledDeck, 0),
      drawNextCard(shuffledDeck, 1),
    ]
    const dealerCards = [
      drawNextCard(shuffledDeck, 2),
      drawNextCard(shuffledDeck, 3),
    ]

    const playerTotal = calculateHandValue(playerCards)
    const dealerTotal = calculateHandValue(dealerCards)

    const playerHasBlackjack = playerCards.length === 2 && playerTotal === 21
    const dealerHasBlackjack = dealerCards.length === 2 && dealerTotal === 21

    let resultId: BJResults

    if (playerHasBlackjack || dealerHasBlackjack) {
      if (playerHasBlackjack && dealerHasBlackjack) {
        resultId = 'BBJ'
        user.balance += parsedBetAmount
        await Transaction.create({
          userId: user.userId,
          guildId: user.guildId,
          amount: parsedBetAmount,
          type: 'win',
          source: 'casino',
          betId,
          createdAt: new Date(),
        })
      } else if (playerHasBlackjack) {
        resultId = 'PBJ'
        user.balance += parsedBetAmount * 2.5
        await Transaction.create({
          userId: user.userId,
          guildId: user.guildId,
          amount: parsedBetAmount * 2.5,
          type: 'win',
          source: 'casino',
          betId,
          createdAt: new Date(),
        })
      } else if (dealerHasBlackjack) {
        resultId = 'DBJ'
      }

      await user.save()

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
            user.balance,
            betId
          ),
        ],
      })
    }

    const message = await interaction.fetchReply()

    const game = new BlackjackGame({
      gameId: message.id,
      userId: interaction.user.id,
      guildId: interaction.guildId,
      betAmount: parsedBetAmount,
      deck: shuffledDeck,
      playerCards,
      dealerCards,
    })

    await game.save()

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
        ),
      ],
      components: [row],
    })
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
