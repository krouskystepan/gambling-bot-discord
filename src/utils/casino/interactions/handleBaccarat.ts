import type { BaccaratBetSide } from 'gambling-bot-shared/casino'
import { validateBetAmount } from 'gambling-bot-shared/casino'
import {
  parseReadableStringToNumber,
  sessionBetId
} from 'gambling-bot-shared/common'
import {
  USER_BANNED_ERROR,
  USER_BANNED_MESSAGE,
  isUserBanned
} from 'gambling-bot-shared/user'

import {
  ActionRowBuilder,
  Interaction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js'

import { handleUnexpectedButtonError } from '@/errors'
import {
  deleteBaccaratGame,
  getBaccaratGameByGameId,
  getGuildConfigByGuildId,
  getUser,
  reserveCasinoBet,
  updateBaccaratGame
} from '@/services'
import { runWithQuestNotifyInteraction } from '@/services/quests'
import {
  decodeId,
  decodeModalId,
  encodeModalId,
  playBaccaratSide,
  renderBaccaratButtons,
  renderBaccaratPromptEmbed
} from '@/utils/casino/baccarat'
import {
  replyBetValidationError,
  replyEphemeralError
} from '@/utils/casino/betValidationReply'
import { dealBaccarat } from '@/utils/casino/rng'
import { formatSessionSummaryEmbed } from '@/utils/casino/sessionSummary'
import { createErrorEmbed } from '@/utils/discord/createEmbed'
import { deferComponentUpdate } from '@/utils/discord/deferComponentUpdate'

const AMOUNT_INPUT_ID = 'amount'

export const handleBaccaratInteraction = async (interaction: Interaction) => {
  const isButton = interaction.isButton()
  const isModal = interaction.isModalSubmit()

  if (!isButton && !isModal) return

  const customId = interaction.customId
  if (!customId.startsWith('bc:') && !customId.startsWith('bcm:')) return

  return runWithQuestNotifyInteraction(interaction, async () => {
    const modalData = isModal ? decodeModalId(interaction.customId) : null
    const buttonData = isButton ? decodeId(interaction.customId) : null
    const gameId = modalData?.gameId ?? buttonData?.gameId
    if (!gameId) return

    const guildId = interaction.guildId
    if (!guildId) return

    try {
      // showModal must be the first response - open immediately from customId.
      if (
        isButton &&
        buttonData != null &&
        'action' in buttonData &&
        buttonData.action === 'amount'
      ) {
        await interaction.showModal(
          new ModalBuilder()
            .setCustomId(encodeModalId({ gameId }))
            .setTitle('Change your baccarat bet')
            .addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId(AMOUNT_INPUT_ID)
                  .setLabel('How much would you like to bet?')
                  .setPlaceholder('e.g. 100, 4k, 10.5k')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              )
            )
        )
        return
      }

      // Acknowledge immediately before any DB work (Discord ~3s timeout).
      if (!(await deferComponentUpdate(interaction))) return

      const guildConfig = await getGuildConfigByGuildId({ guildId })
      if (!guildConfig) {
        await replyEphemeralError(interaction, [
          createErrorEmbed(
            'Error - Missing Config',
            'Guild casino configuration was not found.'
          )
        ])
        return
      }

      const game = await getBaccaratGameByGameId({ gameId, guildId })

      if (!game) {
        await replyEphemeralError(interaction, [
          createErrorEmbed(
            'Error - Invalid Game',
            'This game no longer exists.'
          )
        ])
        return
      }

      if (interaction.user.id !== game.userId) {
        await replyEphemeralError(interaction, [
          createErrorEmbed('Error - Invalid Input', 'This is not your game.')
        ])
        return
      }

      if (game.phase === 'dealing') {
        await replyEphemeralError(interaction, [
          createErrorEmbed(
            'Error - Game Busy',
            'This baccarat hand is still being finished. Please wait a moment.'
          )
        ])
        return
      }

      const sessionMessage = interaction.message
      if (!sessionMessage) return

      const showWaitingTable = async (betAmount: number | null) => {
        await sessionMessage.edit({
          embeds: [
            renderBaccaratPromptEmbed({
              bet: betAmount,
              winMultipliers:
                guildConfig.casinoSettings.baccarat.winMultipliers,
              gameId: game.gameId,
              globalSettings: guildConfig.globalSettings
            })
          ],
          components: renderBaccaratButtons({
            gameId: game.gameId,
            hasBet: betAmount != null && betAmount > 0
          })
        })
      }

      const followUpError = async (title: string, description: string) => {
        if (!interaction.isRepliable()) return
        await interaction.followUp({
          embeds: [createErrorEmbed(title, description)],
          flags: MessageFlags.Ephemeral
        })
      }

      /** Reserves the stake, then deals and settles one round. */
      const playRound = async (side: BaccaratBetSide) => {
        const stake = game.betAmount
        if (stake == null || stake <= 0) {
          return followUpError(
            'Error - Bet Required',
            'Set your bet before picking a side.'
          )
        }

        const user = await getUser({ userId: game.userId, guildId })

        if (!user) {
          return followUpError(
            'Error - Missing User',
            'Your casino profile was not found.'
          )
        }

        if (isUserBanned(user)) {
          return followUpError(
            'Error - Account Restricted',
            USER_BANNED_MESSAGE
          )
        }

        const betId = sessionBetId(
          game.gameId,
          (game.sessionStats?.roundsPlayed ?? 0) + 1
        )

        try {
          await reserveCasinoBet({
            userId: game.userId,
            guildId,
            totalBet: stake,
            betId,
            game: 'baccarat',
            rounds: 1
          })
        } catch (error) {
          if (error instanceof Error && error.message === USER_BANNED_ERROR) {
            return followUpError(
              'Error - Account Restricted',
              USER_BANNED_MESSAGE
            )
          }

          return followUpError(
            'Error - Bet Failed',
            'Not enough balance to place this bet.'
          )
        }

        const round = dealBaccarat()

        await updateBaccaratGame({
          userId: game.userId,
          guildId: game.guildId,
          phase: 'dealing',
          activeBetId: betId,
          pendingDeal: {
            side,
            playerCards: round.playerCards,
            bankerCards: round.bankerCards
          }
        })

        await playBaccaratSide({
          message: sessionMessage,
          side,
          userId: game.userId,
          guildId: game.guildId,
          gameId: game.gameId,
          betId,
          betAmount: stake,
          sessionStats: game.sessionStats,
          showBalance: game.showBalance,
          skipAnimations: game.skipAnimations,
          winMultipliers: guildConfig.casinoSettings.baccarat.winMultipliers,
          globalSettings: guildConfig.globalSettings,
          guild: interaction.guild,
          guildConfig,
          sourceChannelId: game.channelId,
          round
        })
      }

      if (interaction.isModalSubmit()) {
        const amount = parseReadableStringToNumber(
          interaction.fields.getTextInputValue(AMOUNT_INPUT_ID)
        )

        const validation = validateBetAmount(
          amount,
          guildConfig.casinoSettings.baccarat.maxBet,
          guildConfig.casinoSettings.baccarat.minBet
        )
        if (!validation.ok) {
          await replyBetValidationError(
            interaction,
            validation.error,
            guildConfig.casinoSettings.baccarat.maxBet,
            guildConfig.casinoSettings.baccarat.minBet,
            guildConfig.globalSettings
          )
          return
        }

        await updateBaccaratGame({
          userId: game.userId,
          guildId: game.guildId,
          betAmount: amount,
          phase: 'waiting'
        })
        await showWaitingTable(amount)
        return
      }

      if (!buttonData) return

      if (buttonData.kind === 'side') {
        if (game.phase !== 'waiting') {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Table Busy',
              'Use Change before picking a new side.'
            )
          ])
          return
        }

        await playRound(buttonData.side)
        return
      }

      if (buttonData.action === 'close') {
        await deleteBaccaratGame({
          userId: game.userId,
          guildId: game.guildId
        })

        await sessionMessage.edit({
          embeds: [
            formatSessionSummaryEmbed({
              gameLabel: 'Baccarat',
              emoji: '🃏',
              stats: game.sessionStats,
              reason: 'closed',
              gameId: game.gameId,
              globalSettings: guildConfig.globalSettings
            })
          ],
          components: []
        })
        return
      }

      if (buttonData.action === 'change') {
        await updateBaccaratGame({
          userId: game.userId,
          guildId: game.guildId,
          phase: 'waiting'
        })
        await showWaitingTable(game.betAmount)
        return
      }

      if (buttonData.action === 'rebet') {
        if (game.phase !== 'result' || !game.lastSide) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Nothing to Rebet',
              'There is no previous side to rebet.'
            )
          ])
          return
        }

        await playRound(game.lastSide)
      }
    } catch (error) {
      await handleUnexpectedButtonError(interaction, error, {
        handler: 'handleBaccarat'
      })
    }
  })
}
