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
  checkTargetUserRegistration,
  checkUserRegistration,
  createTransaction,
  updateUserBalance
} from '@/services'
import {
  checkValidBet,
  formatNumberToReadableString,
  generateBetId,
  parseReadableStringToNumber
} from '@/utils/common/utils'
import { createBetEmbed, createInfoEmbed } from '@/utils/discord/createEmbed'

const choices = [
  { name: 'rock', emoji: '🪨', beats: 'scissors' },
  { name: 'scissors', emoji: '✂️', beats: 'paper' },
  { name: 'paper', emoji: '📄', beats: 'rock' }
]

export const data: CommandData = {
  name: 'rps',
  description: 'Play rock, paper, scissors with another user.',
  options: [
    {
      name: 'player',
      description: 'The user you want to play against.',
      type: ApplicationCommandOptionType.User,
      required: true
    },
    {
      name: 'bet',
      description: 'Enter a bet (e.g. 1000, 2k, 4.5k).',
      type: ApplicationCommandOptionType.String,
      required: true
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

    const targetDiscordUser = interaction.options.getUser('player', true)
    const targetUser = await checkTargetUserRegistration({
      interaction,
      targetUserId: targetDiscordUser.id
    })
    if (!targetUser) return

    if (interaction.user.id === targetDiscordUser.id || targetDiscordUser.bot) {
      return interaction.reply({
        embeds: [
          createInfoEmbed('Invalid Input', 'Cannot play against this user.')
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const configReply = await checkCasinoChannels(interaction)
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
      components: [row]
    })

    const targetInteraction = await reply
      .awaitMessageComponent({
        filter: (i) => i.user.id === targetDiscordUser.id,
        time: 30_000
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
      flags: MessageFlags.Ephemeral
    })

    embed.setDescription(`Now it's ${interaction.user}'s turn.`)
    await reply.edit({ content: '', embeds: [embed] })

    const initiatorInteraction = await reply
      .awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        time: 30_000
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
      resultText = `${interaction.user} won and took **$${formatNumberToReadableString(
        realWinAmount
      )}** from ${targetDiscordUser}!`
    }

    if (winnerUser && loserUser) {
      const now = new Date()

      await Promise.all([
        updateUserBalance({
          userId: winnerUser.userId,
          guildId: winnerUser.guildId,
          amount: realWinAmount,
          lockedAmount: -Math.min(winnerUser.lockedBalance, betAmount)
        }),

        updateUserBalance({
          userId: loserUser.userId,
          guildId: loserUser.guildId,
          amount: -betAmount,
          lockedAmount: -Math.min(loserUser.lockedBalance, betAmount)
        }),

        createTransaction({
          userId: winnerUser.userId,
          guildId: winnerUser.guildId,
          amount: betAmount,
          type: 'bet',
          source: 'casino',
          betId,
          meta: { role: 'winner' },
          createdAt: now
        }),

        createTransaction({
          userId: loserUser.userId,
          guildId: loserUser.guildId,
          amount: betAmount,
          type: 'bet',
          source: 'casino',
          betId,
          meta: { role: 'loser' },
          createdAt: now
        }),

        createTransaction({
          userId: winnerUser.userId,
          guildId: winnerUser.guildId,
          amount: realWinAmount,
          type: 'win',
          source: 'casino',
          betId,
          createdAt: now
        })
      ])
    }

    embed.setDescription(
      `${targetDiscordUser} chose ${targetChoice.name} ${targetChoice.emoji} \n${interaction.user} chose ${initiatorChoice.name} ${initiatorChoice.emoji}\n\n${resultText}`
    )
    await reply.edit({ content: '', embeds: [embed], components: [] })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
