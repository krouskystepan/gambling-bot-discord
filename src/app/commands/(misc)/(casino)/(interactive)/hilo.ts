import { getHiloWinMultiplier } from 'gambling-bot-shared/casino'
import {
  generateId,
  parseReadableStringToNumber
} from 'gambling-bot-shared/common'

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  betOption,
  checkCasinoChannels,
  checkUserRegistration,
  deleteHiloGame,
  refundLockedBet,
  reserveCasinoBet,
  showBalanceOption,
  upsertHiloGame
} from '@/services'
import { runWithQuestNotifyInteraction } from '@/services/quests'
import { encodeHiloId, renderHiloPromptEmbed } from '@/utils/casino/hilo'
import {
  createShuffledHiloDeck,
  drawHiloCard,
  formatHiloCard
} from '@/utils/casino/rng'
import { checkValidBet } from '@/utils/common/utils'
import { createErrorEmbed } from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'hilo',
  description: 'See a card, then guess higher, lower, or draw (same rank)!',
  options: [betOption, showBalanceOption],
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  return runWithQuestNotifyInteraction(interaction, async () => {
    let reserved = false
    let userId: string | null = null
    let guildId: string | null = null
    let totalBet = 0
    let betId: string | null = null

    const refundIfNeeded = async () => {
      if (!reserved || !userId || !guildId || !betId) return
      await refundLockedBet({
        userId,
        guildId,
        amount: totalBet,
        betId,
        game: 'hilo'
      })
      reserved = false
      await deleteHiloGame({ userId, guildId }).catch(() => undefined)
    }

    try {
      const user = await checkUserRegistration({ interaction })
      if (!user) return
      userId = user.userId
      guildId = user.guildId

      const guildConfig = await checkCasinoChannels(interaction)
      if (!guildConfig) return

      const betAmount = parseReadableStringToNumber(
        interaction.options.getString('bet', true)
      )
      const showBalance = interaction.options.getBoolean('show-balance')

      const isBetValid = checkValidBet(
        interaction,
        betAmount,
        guildConfig.casinoSettings.hilo.maxBet,
        guildConfig.casinoSettings.hilo.minBet,
        guildConfig.globalSettings
      )
      if (!isBetValid) return

      totalBet = betAmount
      const gameId = generateId('hilo')
      betId = gameId

      await interaction.deferReply()

      try {
        await reserveCasinoBet({
          userId,
          guildId,
          totalBet,
          betId,
          game: 'hilo',
          rounds: 1
        })
        reserved = true
      } catch {
        return interaction.editReply({
          embeds: [
            createErrorEmbed(
              'Error - Bet Failed',
              'Not enough balance to place this bet.'
            )
          ]
        })
      }

      const deck = createShuffledHiloDeck()
      const first = drawHiloCard(deck)
      const firstCard = formatHiloCard(first)
      const houseEdge = guildConfig.casinoSettings.hilo.houseEdge
      const timeoutFee = guildConfig.casinoSettings.hilo.timeoutFee
      const higherMult = getHiloWinMultiplier(first.rank, 'higher', houseEdge)
      const lowerMult = getHiloWinMultiplier(first.rank, 'lower', houseEdge)
      const sameMult = getHiloWinMultiplier(first.rank, 'same', houseEdge)
      const globalSettings = guildConfig.globalSettings

      const reply = await interaction.editReply({
        embeds: [
          renderHiloPromptEmbed({
            firstCard,
            higherMult,
            lowerMult,
            sameMult,
            bet: totalBet,
            betId: gameId,
            globalSettings
          })
        ],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(encodeHiloId({ gameId, guess: 'higher' }))
              .setLabel('Higher')
              .setEmoji('⬆')
              .setStyle(ButtonStyle.Success)
              .setDisabled(higherMult == null),
            new ButtonBuilder()
              .setCustomId(encodeHiloId({ gameId, guess: 'same' }))
              .setLabel('Draw')
              .setEmoji('↔')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(sameMult == null),
            new ButtonBuilder()
              .setCustomId(encodeHiloId({ gameId, guess: 'lower' }))
              .setLabel('Lower')
              .setEmoji('⬇')
              .setStyle(ButtonStyle.Danger)
              .setDisabled(lowerMult == null)
          )
        ]
      })

      await upsertHiloGame({
        userId,
        guildId,
        channelId: interaction.channelId,
        messageId: reply.id,
        gameId,
        activeBetId: betId,
        betAmount: totalBet,
        firstCard: first,
        remainingDeck: deck,
        houseEdgeSnapshot: houseEdge,
        timeoutFeeSnapshot: timeoutFee,
        showBalance: Boolean(showBalance),
        status: 'WAITING'
      })

      // Stake is owned by the persisted round + timeout worker from here.
      reserved = false
    } catch (error) {
      await refundIfNeeded()
      await handleUnexpectedInteractionError(interaction, error)
    }
  })
}
