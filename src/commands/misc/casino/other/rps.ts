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
  checkValidBet,
  formatNumberToReadableString,
  generateBetId,
  parseReadableStringToNumber,
} from '../../../../utils/utils'
import Transaction from '../../../../models/Transaction'
import User from '../../../../models/User'

const choices = [
  { name: 'rock', emoji: '🪨', beats: 'scissors' },
  { name: 'scissors', emoji: '✂️', beats: 'paper' },
  { name: 'paper', emoji: '📄', beats: 'rock' },
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
          createErrorEmbed('Error - Not registered', 'Use `/register` first.'),
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
            'Target user not registered.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (interaction.user.id === targetDiscordUser.id || targetDiscordUser.bot) {
      return interaction.reply({
        embeds: [
          createInfoEmbed('Invalid Input', 'Cannot play against this user.'),
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

    const betAmount = parseReadableStringToNumber(
      interaction.options.getString('bet', true)
    )
    const readableBetAmount = formatNumberToReadableString(betAmount)
    const realWinAmount =
      betAmount * (1 - configReply.casinoSettings.rps.casinoCut)

    const isBetValid = checkValidBet(
      interaction,
      betAmount,
      configReply.casinoSettings.rps.maxBet,
      configReply.casinoSettings.rps.minBet,
      user.balance
    )
    if (!isBetValid) return

    const betId = generateBetId()
    const embed = createBetEmbed(
      'Rock, paper, scissors!',
      'Yellow',
      `It’s now ${targetDiscordUser}'s turn!`,
      betId
    )
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      choices.map((c) =>
        new ButtonBuilder()
          .setCustomId(c.name)
          .setLabel(c.name)
          .setStyle(ButtonStyle.Primary)
          .setEmoji(c.emoji)
      )
    )

    const reply = await interaction.reply({
      content: `${targetDiscordUser}, you’ve been challenged by ${interaction.user} to a game of Rock, Paper, Scissors for **$${readableBetAmount}**!\nChoose one of the options to start the game.`,
      embeds: [embed],
      components: [row],
    })

    const targetInteraction = await reply
      .awaitMessageComponent({
        filter: (i) => i.user.id === targetDiscordUser.id,
        time: 30_000,
      })
      .catch(async () => {
        embed
          .setDescription(
            `Game canceled. ${targetDiscordUser} did not respond.`
          )
          .setColor('Red')
        await reply.edit({ content: '', embeds: [embed], components: [] })
        return null
      })
    if (!targetInteraction) return

    const targetChoice = choices.find(
      (c) => c.name === targetInteraction.customId
    )!
    await targetInteraction.reply({
      content: `You chose ${targetChoice.name} ${targetChoice.emoji}.`,
      flags: MessageFlags.Ephemeral,
    })

    embed.setDescription(`Now it's ${interaction.user}'s turn.`)
    await reply.edit({ content: '', embeds: [embed] })

    const initiatorInteraction = await reply
      .awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        time: 30_000,
      })
      .catch(async () => {
        embed
          .setDescription(`Game canceled. ${interaction.user} did not respond.`)
          .setColor('Red')
        await reply.edit({ content: '', embeds: [embed], components: [] })
        return null
      })
    if (!initiatorInteraction) return

    const initiatorChoice = choices.find(
      (c) => c.name === initiatorInteraction.customId
    )!

    let winnerUser: typeof user | typeof targetUser | null = null
    let loserUser: typeof user | typeof targetUser | null = null
    let resultText = 'It’s a draw!'

    if (targetChoice.beats === initiatorChoice.name) {
      winnerUser = targetUser
      loserUser = user
      resultText = `${targetDiscordUser} won and took **$${formatNumberToReadableString(
        realWinAmount
      )}** from ${interaction.user}!`
    } else if (initiatorChoice.beats === targetChoice.name) {
      winnerUser = user
      loserUser = targetUser
      resultText = `${
        interaction.user
      } won and took **$${formatNumberToReadableString(
        realWinAmount
      )}** from ${targetDiscordUser}!`
    }

    if (winnerUser && loserUser) {
      await Promise.all([
        User.findOneAndUpdate(
          { userId: winnerUser.userId, guildId: winnerUser.guildId },
          {
            $inc: {
              balance: realWinAmount,
              lockedBalance: -Math.min(winnerUser.lockedBalance, betAmount),
            },
          }
        ),
        User.findOneAndUpdate(
          { userId: loserUser.userId, guildId: loserUser.guildId },
          {
            $inc: {
              balance: -betAmount,
              lockedBalance: -Math.min(loserUser.lockedBalance, betAmount),
            },
          }
        ),
        Transaction.insertMany([
          {
            userId: winnerUser.userId,
            guildId: winnerUser.guildId,
            amount: betAmount,
            type: 'bet',
            source: 'casino',
            betId,
            createdAt: new Date(),
          },
          {
            userId: loserUser.userId,
            guildId: loserUser.guildId,
            amount: betAmount,
            type: 'bet',
            source: 'casino',
            betId,
            createdAt: new Date(),
          },
          {
            userId: winnerUser.userId,
            guildId: winnerUser.guildId,
            amount: realWinAmount,
            type: 'win',
            source: 'casino',
            betId,
            createdAt: new Date(),
          },
        ]),
      ])
    }

    embed.setDescription(
      `${targetDiscordUser} chose ${targetChoice.name} ${targetChoice.emoji} \n${interaction.user} chose ${initiatorChoice.name} ${initiatorChoice.emoji}\n\n${resultText}`
    )
    await reply.edit({ content: '', embeds: [embed], components: [] })
  } catch (error) {
    console.error('Error running RPS command:', error)
  }
}
