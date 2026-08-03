import type {
  BaccaratBetSide,
  BaccaratSlipBet
} from 'gambling-bot-shared/casino'
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
  BACCARAT_MAX_SLIP_BETS,
  BACCARAT_SIDE_LABELS,
  buildSlipBet,
  decodeId,
  decodeModalId,
  encodeModalId,
  mergeSlipBet,
  playBaccaratSlip,
  renderBaccaratButtons,
  renderBaccaratPromptEmbed,
  slipTotal
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

const showAmountModal = async (
  interaction: Interaction,
  gameId: string,
  side: BaccaratBetSide
) => {
  if (!interaction.isMessageComponent()) return

  await interaction.showModal(
    new ModalBuilder()
      .setCustomId(encodeModalId({ gameId, side }))
      .setTitle(`Bet on ${BACCARAT_SIDE_LABELS[side]}`.slice(0, 45))
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
}

export const handleBaccaratInteraction = async (interaction: Interaction) => {
  const isButton = interaction.isButton()
  const isModal = interaction.isModalSubmit()

  if (!isButton && !isModal) return

  const customId = interaction.customId
  if (!customId.startsWith('bc:') && !customId.startsWith('bcm:')) return

  return runWithQuestNotifyInteraction(interaction, async () => {
    const guildId = interaction.guildId
    if (!guildId) return

    try {
      if (isModal) {
        const modalData = decodeModalId(interaction.customId)
        if (!modalData) return

        if (!(await deferComponentUpdate(interaction))) return

        const game = await getBaccaratGameByGameId({
          gameId: modalData.gameId,
          guildId
        })

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

        if (game.phase !== 'waiting') {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Table Busy',
              'Finish or change bets from the result buttons first.'
            )
          ])
          return
        }

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

        const amount = parseReadableStringToNumber(
          interaction.fields.getTextInputValue(AMOUNT_INPUT_ID)
        )

        const lineValidation = validateBetAmount(
          amount,
          guildConfig.casinoSettings.baccarat.maxBet,
          guildConfig.casinoSettings.baccarat.minBet
        )
        if (!lineValidation.ok) {
          await replyBetValidationError(
            interaction,
            lineValidation.error,
            guildConfig.casinoSettings.baccarat.maxBet,
            guildConfig.casinoSettings.baccarat.minBet,
            guildConfig.globalSettings
          )
          return
        }

        const merged = mergeSlipBet(
          game.bets ?? [],
          buildSlipBet(modalData.side, amount)
        )
        if (
          merged.length > BACCARAT_MAX_SLIP_BETS &&
          merged.length > (game.bets?.length ?? 0)
        ) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Slip Full',
              `You can place at most **${BACCARAT_MAX_SLIP_BETS}** different sides on one deal.`
            )
          ])
          return
        }

        const total = slipTotal(merged)
        const totalValidation = validateBetAmount(
          total,
          guildConfig.casinoSettings.baccarat.maxBet,
          guildConfig.casinoSettings.baccarat.minBet
        )
        if (!totalValidation.ok) {
          await replyBetValidationError(
            interaction,
            totalValidation.error,
            guildConfig.casinoSettings.baccarat.maxBet,
            guildConfig.casinoSettings.baccarat.minBet,
            guildConfig.globalSettings
          )
          return
        }

        const updated = await updateBaccaratGame({
          userId: game.userId,
          guildId: game.guildId,
          bets: merged,
          phase: 'waiting'
        })

        if (!updated || !interaction.message) return

        await interaction.message.edit({
          embeds: [
            renderBaccaratPromptEmbed({
              bets: updated.bets,
              gameId: game.gameId,
              globalSettings: guildConfig.globalSettings
            })
          ],
          components: renderBaccaratButtons({
            gameId: game.gameId,
            hasBets: updated.bets.length > 0,
            hasLastBets: (updated.lastBets?.length ?? 0) > 0
          })
        })
        return
      }

      const buttonData = decodeId(interaction.customId)
      if (!buttonData) return

      // Place opens a modal - showModal must be the first response.
      if (buttonData.kind === 'place') {
        await showAmountModal(interaction, buttonData.gameId, buttonData.side)
        return
      }

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

      const game = await getBaccaratGameByGameId({
        gameId: buttonData.gameId,
        guildId
      })

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

      const showWaitingTable = async (bets: BaccaratSlipBet[]) => {
        await sessionMessage.edit({
          embeds: [
            renderBaccaratPromptEmbed({
              bets,
              gameId: game.gameId,
              globalSettings: guildConfig.globalSettings
            })
          ],
          components: renderBaccaratButtons({
            gameId: game.gameId,
            hasBets: bets.length > 0,
            hasLastBets: (game.lastBets?.length ?? 0) > 0
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

      /** Reserves the slip total, then deals and settles one round. */
      const playRound = async (slip: BaccaratSlipBet[]) => {
        if (slip.length === 0) {
          return followUpError(
            'Error - Empty Slip',
            'Add at least one bet before dealing.'
          )
        }

        const stake = slipTotal(slip)
        const validation = validateBetAmount(
          stake,
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
          bets: slip,
          lockedAmount: stake,
          pendingDeal: {
            playerCards: round.playerCards,
            bankerCards: round.bankerCards
          }
        })

        await playBaccaratSlip({
          message: sessionMessage,
          bets: slip,
          userId: game.userId,
          guildId: game.guildId,
          gameId: game.gameId,
          betId,
          sessionStats: game.sessionStats,
          showBalance: game.showBalance,
          skipAnimations: game.skipAnimations,
          baccaratSettings: guildConfig.casinoSettings.baccarat,
          globalSettings: guildConfig.globalSettings,
          guild: interaction.guild,
          guildConfig,
          sourceChannelId: game.channelId,
          round
        })
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
          phase: 'waiting',
          bets: []
        })
        await showWaitingTable([])
        return
      }

      if (buttonData.action === 'undo') {
        if (game.phase !== 'waiting' || (game.bets?.length ?? 0) === 0) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Nothing to Undo',
              'Your slip is already empty.'
            )
          ])
          return
        }

        const nextBets = game.bets.slice(0, -1)
        await updateBaccaratGame({
          userId: game.userId,
          guildId: game.guildId,
          bets: nextBets
        })
        await showWaitingTable(nextBets)
        return
      }

      if (buttonData.action === 'clear') {
        if (game.phase !== 'waiting') {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Table Busy',
              'Use Change from the result view first.'
            )
          ])
          return
        }

        await updateBaccaratGame({
          userId: game.userId,
          guildId: game.guildId,
          bets: []
        })
        await showWaitingTable([])
        return
      }

      if (buttonData.action === 'deal' || buttonData.action === 'rebet') {
        const slip =
          buttonData.action === 'rebet'
            ? (game.lastBets ?? [])
            : game.phase === 'waiting'
              ? (game.bets ?? [])
              : []

        if (slip.length === 0) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              buttonData.action === 'rebet'
                ? 'Error - Nothing to Rebet'
                : 'Error - Empty Slip',
              buttonData.action === 'rebet'
                ? 'There is no previous slip to rebet.'
                : 'Add at least one bet before dealing.'
            )
          ])
          return
        }

        await playRound(slip)
      }
    } catch (error) {
      await handleUnexpectedButtonError(interaction, error, {
        handler: 'handleBaccarat'
      })
    }
  })
}
