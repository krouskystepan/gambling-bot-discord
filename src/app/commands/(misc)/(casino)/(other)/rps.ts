import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  checkCasinoChannels,
  checkTargetUserRegistration,
  checkUserRegistration,
  reserveCasinoBet,
  settleRpsGameAtomic
} from '@/services'
import {
  checkValidBet,
  formatNumberToReadableString,
  generateId,
  parseReadableStringToNumber
} from '@/utils/common/utils'
import {
  createBetEmbed,
  createErrorEmbed,
  createInfoEmbed
} from '@/utils/discord/createEmbed'

const choices = [
  { name: 'rock', emoji: '🪨', beats: 'scissors' },
  { name: 'scissors', emoji: '✂️', beats: 'paper' },
  { name: 'paper', emoji: '📄', beats: 'rock' }
]

export const command: CommandData = {
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

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  let p1Reserved = false
  let p2Reserved = false
  let refundBoth!: () => Promise<void>

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
      configReply.casinoSettings.rps.minBet
    )
    if (!isBetValid) return

    await interaction.deferReply()

    const betId = generateId()

    refundBoth = async () => {
      if (!p1Reserved && !p2Reserved) return

      await settleRpsGameAtomic({
        p1UserId: user.userId,
        p1GuildId: user.guildId,
        p2UserId: targetUser.userId,
        p2GuildId: targetUser.guildId,
        betAmount,
        winnerUserId: null, // draw = full refund
        casinoCut: 0,
        betId
      })

      p1Reserved = false
      p2Reserved = false
    }

    try {
      await reserveCasinoBet({
        userId: user.userId,
        guildId: user.guildId,
        totalBet: betAmount,
        betId
      })
      p1Reserved = true

      await reserveCasinoBet({
        userId: targetUser.userId,
        guildId: targetUser.guildId,
        totalBet: betAmount,
        betId
      })
      p2Reserved = true
    } catch {
      await refundBoth()

      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            'Bet Failed',
            'One of the players no longer has enough balance to place this bet.'
          )
        ]
      })
    }

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

    const reply = await interaction.editReply({
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
        await refundBoth()

        embed.setDescription(
          `Game canceled. ${targetDiscordUser} did not respond.`
        )
        embed.setColor('Red')
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
        await refundBoth()

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
      await settleRpsGameAtomic({
        p1UserId: user.userId,
        p1GuildId: user.guildId,
        p2UserId: targetUser.userId,
        p2GuildId: targetUser.guildId,
        betAmount,
        winnerUserId: winnerUser ? winnerUser.userId : null,
        casinoCut: configReply.casinoSettings.rps.casinoCut,
        betId
      })

      p1Reserved = false
      p2Reserved = false
    }

    if (!winnerUser && !loserUser) {
      await refundBoth()
    }

    embed.setDescription(
      `${targetDiscordUser} chose ${targetChoice.name} ${targetChoice.emoji} \n${interaction.user} chose ${initiatorChoice.name} ${initiatorChoice.emoji}\n\n${resultText}`
    )
    await reply.edit({ content: '', embeds: [embed], components: [] })
  } catch (error) {
    try {
      await refundBoth()
    } catch {}

    await handleUnexpectedInteractionError(interaction, error)
  }
}
