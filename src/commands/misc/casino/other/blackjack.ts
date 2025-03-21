import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ColorResolvable,
  MessageFlags,
} from 'discord.js'
import {
  createErrorEmbed,
  createInfoEmbed,
} from '../../../../utils/createEmbed'
import {
  shuffleDeck,
  DECK,
  calculateHandValue,
  createBlackjackEmbed,
} from '../../../../utils/blackjackUtils'
import BlackjackGame from '../../../../models/BlackjackGame'
import { drawNextCard } from '../../../../utils/casinoHelpers'
import {
  checkUserRegistration,
  checkChannelConfiguration,
  parseReadableStringToNumber,
  formatNumberToReadableString,
} from '../../../../utils/utils'
import { BLACKJACK_MAX_BET } from '../../../../utils/casinoConfig'

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
  contexts: [0],
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
          'This server has not been configured for betting commands yet.\nSet it up using `/setup-casino`.',
        notAllowed: `This channel is not configured for betting commands.\nTry one of these channels:`,
      }
    )

    if (configReply) return

    const betAmount = interaction.options.getString('bet', true)
    const parsedBetAmount = parseReadableStringToNumber(betAmount)
    const readableBetAmount = formatNumberToReadableString(parsedBetAmount)
    const showBalance = interaction.options.getBoolean('show-balance')

    if (isNaN(parsedBetAmount)) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Not a number',
            'The value you entered is not a valid number.\nPlease make sure you enter a numerical value.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (parsedBetAmount <= 0) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Non-positive number',
            'The number you provided must be greater than 0.\nPlease enter a positive value.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (BLACKJACK_MAX_BET > 0 && parsedBetAmount > BLACKJACK_MAX_BET) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Above Maximum Bet',
            `The maximum bet is **$${formatNumberToReadableString(
              BLACKJACK_MAX_BET
            )}**.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (user.balance < parsedBetAmount) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Insufficient Funds',
            `You don't have enough money to place this bet.\nYour current balance is **$${formatNumberToReadableString(
              user.balance
            )}**.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    await interaction.deferReply()

    user.balance -= parsedBetAmount
    await user.save()

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

    let resultText = ''
    let resultColor: ColorResolvable = 'Yellow'

    if (playerHasBlackjack || dealerHasBlackjack) {
      if (playerHasBlackjack && dealerHasBlackjack) {
        user.balance += parsedBetAmount
        resultText = `You both have Blackjack!\n💰 Total: 🟡 **$${readableBetAmount}**`
      } else if (playerHasBlackjack) {
        const winAmount = parsedBetAmount * 2.5
        user.balance += winAmount
        resultText = `You have Blackjack!\n💰 Total: 🟢 **$${formatNumberToReadableString(
          winAmount
        )}**`
        resultColor = 'Green'
      } else if (dealerHasBlackjack) {
        resultText = `Dealer has Blackjack!\n💰 Total: 🔴 **$${formatNumberToReadableString(
          parsedBetAmount * -1
        )}**`
        resultColor = 'Red'
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
            resultColor,
            `**Result:**\n${resultText}${
              showBalance
                ? `\n🏦 Balance: **$${formatNumberToReadableString(
                    user.balance
                  )}**`
                : ''
            }`
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
      showBalance,
    })

    await game.save()

    const hitButton = new ButtonBuilder()
      .setCustomId(
        `blackjack.${message.id}-${interaction.user.id}-${interaction.guildId}.hit`
      )
      .setLabel('Hit')
      .setStyle(ButtonStyle.Success)

    const standButton = new ButtonBuilder()
      .setCustomId(
        `blackjack.${message.id}-${interaction.user.id}-${interaction.guildId}.stand`
      )
      .setLabel('Stand')
      .setStyle(ButtonStyle.Danger)

    const doubleButton = new ButtonBuilder()
      .setCustomId(
        `blackjack.${message.id}-${interaction.user.id}-${interaction.guildId}.double`
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
          'Yellow',
          showBalance
            ? `🏦 Balance: **$${formatNumberToReadableString(user.balance)}**`
            : undefined,
          true
        ),
      ],
      components: [row],
    })
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
