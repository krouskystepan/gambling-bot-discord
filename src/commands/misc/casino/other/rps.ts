import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js'
import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'
import {
  createBetEmbed,
  createErrorEmbed,
  createInfoEmbed,
} from '../../../../utils/createEmbed'
import {
  checkChannelConfiguration,
  checkUserRegistration,
  formatNumberToReadableString,
  parseReadableStringToNumber,
} from '../../../../utils/utils'

const choices = [
  {
    name: 'rock',
    emoji: '🪨',
    beats: 'scissors',
  },
  {
    name: 'scissors',
    emoji: '✂️',
    beats: 'paper',
  },
  {
    name: 'paper',
    emoji: '📄',
    beats: 'rock',
  },
]

export const data: CommandData = {
  name: 'rps',
  description: 'Play rock, paper, scissors with another user.',
  options: [
    {
      name: 'player',
      description: 'The user you want to play against.',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: 'bet',
      description: 'Enter a bet (e.g. 1000, 2k, 4.5k).',
      type: ApplicationCommandOptionType.String,
      required: true,
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

    const targetDiscordUser = interaction.options.getUser('player', true)
    const targetUser = await checkUserRegistration(
      targetDiscordUser.id,
      interaction.guildId!
    )

    if (!targetUser) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Not registered',
            'The user you want to play against is not registered yet.'
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

    if (!configReply) return

    if (interaction.user.id === targetDiscordUser.id) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Same user',
            'You cannot play against yourself.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (targetDiscordUser.bot) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Bot user',
            'You cannot play against a bot.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const betAmount = interaction.options.getString('bet', true)
    const parsedBetAmount = parseReadableStringToNumber(betAmount)
    const readableBetAmount = formatNumberToReadableString(parsedBetAmount)
    const realWinAmount = parsedBetAmount * (1 - configReply.rps.casinoCut)

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

    if (
      configReply.rps.maxBet > 0 &&
      parsedBetAmount > configReply.rps.maxBet
    ) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Above Maximum Bet',
            `The maximum bet is **$${formatNumberToReadableString(
              configReply.rps.maxBet
            )}**.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (
      configReply.rps.minBet > 0 &&
      parsedBetAmount < configReply.rps.minBet
    ) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Below Minimum Bet',
            `The minimum bet is **$${formatNumberToReadableString(
              configReply.rps.minBet
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
            'Insufficient balance',
            `You don't have enough money to place this bet.\nYour current balance is **$${formatNumberToReadableString(
              user.balance
            )}**.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const embed = createBetEmbed(
      'Rock, paper, scissors!',
      'Yellow',
      `It’s now ${targetDiscordUser}'s turn!`
    )

    const buttons = choices.map((choice) => {
      return new ButtonBuilder()
        .setCustomId(choice.name)
        .setLabel(choice.name)
        .setStyle(ButtonStyle.Primary)
        .setEmoji(choice.emoji)
    })

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)

    const reply = await interaction.reply({
      content: `${targetDiscordUser}, you’ve been challenged by ${interaction.user} to a game of Rock, Paper, Scissors for **$${readableBetAmount}**!\nChoose one of the options to start the game.`,
      embeds: [embed],
      components: [row],
    })

    const targetUserInteraction = await reply
      .awaitMessageComponent({
        filter: (i) => {
          if (i.user.id !== targetDiscordUser.id) {
            i.reply({
              embeds: [
                createInfoEmbed(
                  'Invalid Input - Wrong user',
                  'Only the mentioned user can interact with this message.'
                ),
              ],
              flags: MessageFlags.Ephemeral,
            })
            return false
          }
          return true
        },
        time: 30_000,
      })
      .catch(async (error) => {
        embed
          .setDescription(
            `The game has been canceled because ${targetDiscordUser} did not respond in time.`
          )
          .setColor('Red')
        await reply.edit({
          content: '',
          embeds: [embed],
          components: [],
        })
      })

    if (!targetUserInteraction) return

    if (targetUser.balance < parsedBetAmount) {
      embed
        .setDescription(
          `The game has been canceled because ${targetDiscordUser} does not have enough money to place the bet.`
        )
        .setColor('Red')

      reply.edit({
        content: '',
        embeds: [embed],
        components: [],
      })

      return targetUserInteraction.reply({
        embeds: [
          createInfoEmbed(
            'Insufficient balance',
            `You don't have enough money to place this bet.\nYour current balance is **$${formatNumberToReadableString(
              targetUser.balance
            )}**.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const targetUserChoice = choices.find(
      (choice) => choice.name === targetUserInteraction.customId
    )

    await targetUserInteraction.reply({
      content: `You chose ${targetUserChoice?.name} ${targetUserChoice?.emoji}.`,
      flags: MessageFlags.Ephemeral,
    })

    embed.setDescription(
      `It’s now ${interaction.user}'s turn! Choose one of the options.`
    )
    await reply.edit({
      content: `Now it's your turn, ${interaction.user}!`,
      embeds: [embed],
    })

    const initialUserInteraction = await reply
      .awaitMessageComponent({
        filter: (i) => {
          if (i.user.id !== interaction.user.id) {
            i.reply({
              embeds: [
                createInfoEmbed(
                  'Invalid Input - Wrong user',
                  'Only the mentioned user can interact with this message.'
                ),
              ],
              flags: MessageFlags.Ephemeral,
            })
            return false
          }
          return true
        },
        time: 30_000,
      })
      .catch(async (error) => {
        embed
          .setDescription(
            `The game has been canceled because ${interaction.user} did not respond in time.`
          )
          .setColor('Red')
        await reply.edit({
          content: '',
          embeds: [embed],
          components: [],
        })
      })

    if (!initialUserInteraction) return

    const initialUserChoice = choices.find(
      (choice) => choice.name === initialUserInteraction.customId
    )

    let result = ''

    if (targetUserChoice?.beats === initialUserChoice?.name) {
      result = `${targetDiscordUser} won and took **$${formatNumberToReadableString(
        realWinAmount
      )}** from ${interaction.user}!`

      user.balance -= parsedBetAmount
      targetUser.balance += realWinAmount
      await user.save()
      await targetUser.save()
    }

    if (initialUserChoice?.beats === targetUserChoice?.name) {
      result = `${
        interaction.user
      } won and took **$${formatNumberToReadableString(
        realWinAmount
      )}** from ${targetDiscordUser}!`

      user.balance += realWinAmount
      targetUser.balance -= parsedBetAmount
      await user.save()
      await targetUser.save()
    }

    if (targetUserChoice?.name === initialUserChoice?.name) {
      result = 'It’s a draw!'
    }

    embed.setDescription(
      `${targetDiscordUser} chose ${targetUserChoice?.name} ${targetUserChoice?.emoji} \n${interaction.user} chose ${initialUserChoice?.name} ${initialUserChoice?.emoji}. \n\n${result}`
    )
    reply.edit({
      content: '',
      embeds: [embed],
      components: [],
    })
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
