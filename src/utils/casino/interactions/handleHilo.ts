import { validateBetAmount } from 'gambling-bot-shared/casino'
import { parseReadableStringToNumber } from 'gambling-bot-shared/common'
import {
  USER_BANNED_ERROR,
  USER_BANNED_MESSAGE
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
  deleteHiloGame,
  getGuildConfigByGuildId,
  getHiloGameByGameId,
  updateHiloGame
} from '@/services'
import { runWithQuestNotifyInteraction } from '@/services/quests'
import {
  replyBetValidationError,
  replyEphemeralError
} from '@/utils/casino/betValidationReply'
import {
  cashOutHilo,
  decodeHiloId,
  decodeModalId,
  encodeModalId,
  renderHiloBettingComponents,
  renderHiloBettingEmbed,
  settleHiloGuess,
  startHiloRound
} from '@/utils/casino/hilo'
import { formatSessionSummaryEmbed } from '@/utils/casino/sessionSummary'
import { createErrorEmbed } from '@/utils/discord/createEmbed'
import { deferComponentUpdate } from '@/utils/discord/deferComponentUpdate'

const BET_INPUT_ID = 'bet'

export const handleHiloInteraction = async (interaction: Interaction) => {
  const isButton = interaction.isButton()
  const isModal = interaction.isModalSubmit()

  if (!isButton && !isModal) return

  const customId = interaction.customId
  if (!customId.startsWith('hl:') && !customId.startsWith('hlm:')) return

  return runWithQuestNotifyInteraction(interaction, async () => {
    const modalData = isModal ? decodeModalId(interaction.customId) : null
    const buttonData = isButton ? decodeHiloId(interaction.customId) : null
    const gameId = modalData?.gameId ?? buttonData?.gameId
    if (!gameId) return

    const guildId = interaction.guildId
    if (!guildId) return

    try {
      // showModal must be the first response - open immediately from customId.
      if (
        isButton &&
        buttonData?.kind === 'action' &&
        buttonData.action === 'change'
      ) {
        await interaction.showModal(
          new ModalBuilder()
            .setCustomId(encodeModalId({ gameId }))
            .setTitle('Set your Hi-Lo bet')
            .addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId(BET_INPUT_ID)
                  .setLabel('How much would you like to bet?')
                  .setPlaceholder('e.g. 100, 4k, 10.5k')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              )
            )
        )
        return
      }

      if (!(await deferComponentUpdate(interaction))) return

      const guildConfig = await getGuildConfigByGuildId({ guildId })
      const globalSettings = guildConfig?.globalSettings

      const game = await getHiloGameByGameId({ gameId, guildId })

      if (!game) {
        await replyEphemeralError(interaction, [
          createErrorEmbed(
            'Error - Invalid Game',
            'This Hi-Lo table no longer exists.'
          )
        ])
        return
      }

      if (interaction.user.id !== game.userId) {
        await replyEphemeralError(interaction, [
          createErrorEmbed(
            'Error - Not Your Game',
            'Only the player who opened this table can use it.'
          )
        ])
        return
      }

      const sessionMessage = interaction.message
      if (!sessionMessage) return

      const followUpError = async (title: string, description: string) => {
        if (!interaction.isRepliable()) return
        await interaction.followUp({
          embeds: [createErrorEmbed(title, description)],
          flags: MessageFlags.Ephemeral
        })
      }

      const dealRound = async (betAmount: number) => {
        if (!guildConfig) {
          return followUpError(
            'Error - Missing Config',
            'Casino settings could not be loaded.'
          )
        }

        try {
          const round = await startHiloRound({
            userId: game.userId,
            guildId: game.guildId,
            gameId: game.gameId,
            channelId: game.channelId,
            messageId: game.messageId,
            betAmount,
            houseEdge: guildConfig.casinoSettings.hilo.houseEdge,
            showBalance: game.showBalance,
            skipAnimations: game.skipAnimations,
            sessionStats: game.sessionStats,
            globalSettings: guildConfig.globalSettings
          })

          await sessionMessage.edit({
            content: null,
            embeds: round.embeds,
            components: round.components
          })
        } catch (error) {
          if (error instanceof Error && error.message === USER_BANNED_ERROR) {
            return followUpError(
              'Error - Account Restricted',
              USER_BANNED_MESSAGE
            )
          }

          if (
            error instanceof Error &&
            error.message === 'INSUFFICIENT_FUNDS'
          ) {
            return followUpError(
              'Error - Bet Failed',
              'Not enough balance to place this bet.'
            )
          }
          throw error
        }
      }

      if (interaction.isModalSubmit()) {
        if (game.status !== 'RESULT' && game.status !== 'BETTING') {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Round In Progress',
              'Finish the current round before changing your bet.'
            )
          ])
          return
        }

        if (!guildConfig) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Missing Config',
              'Casino settings could not be loaded.'
            )
          ])
          return
        }

        const hiloSettings = guildConfig.casinoSettings.hilo
        const betAmount = parseReadableStringToNumber(
          interaction.fields.getTextInputValue(BET_INPUT_ID)
        )

        const validation = validateBetAmount(
          betAmount,
          hiloSettings.maxBet,
          hiloSettings.minBet
        )
        if (!validation.ok) {
          await replyBetValidationError(
            interaction,
            validation.error,
            hiloSettings.maxBet,
            hiloSettings.minBet,
            guildConfig.globalSettings
          )
          return
        }

        await updateHiloGame({
          userId: game.userId,
          guildId: game.guildId,
          betAmount,
          status: 'BETTING',
          activeBetId: null,
          firstCard: null,
          remainingDeck: [],
          currentMultiplier: 1,
          streak: 0,
          houseEdgeSnapshot: hiloSettings.houseEdge
        })

        await sessionMessage.edit({
          content: null,
          embeds: [
            renderHiloBettingEmbed({
              gameId: game.gameId,
              bet: betAmount,
              globalSettings: guildConfig.globalSettings
            })
          ],
          components: renderHiloBettingComponents({
            gameId: game.gameId,
            hasBet: true
          })
        })
        return
      }

      if (!buttonData) return

      if (buttonData.kind === 'action' && buttonData.action === 'cashout') {
        if (game.status !== 'WAITING') {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Invalid Game',
              'This Hi-Lo round is no longer waiting for a cash-out.'
            )
          ])
          return
        }

        if ((game.streak ?? 0) < 1) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Cannot Cash Out',
              'Win at least one guess before cashing out.'
            )
          ])
          return
        }

        if (!guildConfig) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Missing Config',
              'Casino settings could not be loaded.'
            )
          ])
          return
        }

        await cashOutHilo({
          game,
          guildConfig,
          guild: interaction.guild,
          sourceChannelId: interaction.channelId,
          message: sessionMessage
        })
        return
      }

      if (buttonData.kind === 'action') {
        if (game.status !== 'RESULT' && game.status !== 'BETTING') {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Round In Progress',
              'Finish the current round first.'
            )
          ])
          return
        }

        if (buttonData.action === 'close') {
          await deleteHiloGame({
            userId: game.userId,
            guildId: game.guildId
          })

          await sessionMessage.edit({
            content: null,
            embeds: [
              formatSessionSummaryEmbed({
                gameLabel: 'Hi-Lo',
                emoji: '🃏',
                stats: game.sessionStats,
                reason: 'closed',
                gameId: game.gameId,
                globalSettings,
                roundsLabel: 'Rounds'
              })
            ],
            components: []
          })
          return
        }

        if (buttonData.action === 'change') return

        if (
          buttonData.action === 'deal'
            ? game.status !== 'BETTING'
            : game.status !== 'RESULT'
        ) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Round In Progress',
              'Finish the current round before dealing a new one.'
            )
          ])
          return
        }

        const stake = game.betAmount
        if (stake == null || stake <= 0) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Bet Required',
              'Set your bet before dealing.'
            )
          ])
          return
        }

        await dealRound(stake)
        return
      }

      if (buttonData.kind === 'guess') {
        if (game.status !== 'WAITING') {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Invalid Game',
              'This Hi-Lo round is no longer waiting for a guess.'
            )
          ])
          return
        }

        if (!guildConfig) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Missing Config',
              'Casino settings could not be loaded.'
            )
          ])
          return
        }

        await settleHiloGuess({
          game,
          guess: buttonData.guess,
          guildConfig,
          guild: interaction.guild,
          sourceChannelId: interaction.channelId,
          message: sessionMessage
        })
      }
    } catch (error) {
      await handleUnexpectedButtonError(interaction, error, {
        handler: 'handleHilo'
      })
    }
  })
}
