import { validateBetAmount } from 'gambling-bot-shared/casino'
import { parseReadableStringToNumber } from 'gambling-bot-shared/common'
import {
  cashOutPayout,
  docToMinesEngine,
  isValidMineCount,
  revealCell
} from 'gambling-bot-shared/mines'
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
  deleteMinesGame,
  getGuildConfigByGuildId,
  getMinesGameByGameId,
  saveMinesGame,
  updateMinesGame
} from '@/services'
import { runWithQuestNotifyInteraction } from '@/services/quests'
import {
  replyBetValidationError,
  replyEphemeralError
} from '@/utils/casino/betValidationReply'
import {
  decodeId,
  decodeModalId,
  encodeModalId,
  finishMinesAndSettle,
  renderMinesButtons,
  renderMinesEmbed,
  renderMinesSetupComponents,
  renderMinesSetupEmbed,
  startMinesBoard
} from '@/utils/casino/mines'
import { formatSessionSummaryEmbed } from '@/utils/casino/sessionSummary'
import { createErrorEmbed } from '@/utils/discord/createEmbed'
import { deferComponentUpdate } from '@/utils/discord/deferComponentUpdate'

const BET_INPUT_ID = 'bet'
const MINES_INPUT_ID = 'mines'

export const handleMinesInteraction = async (interaction: Interaction) => {
  const isButton = interaction.isButton()
  const isModal = interaction.isModalSubmit()

  if (!isButton && !isModal) return

  const customId = interaction.customId
  if (!customId.startsWith('mines:') && !customId.startsWith('minesm:')) return

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
        buttonData?.action.kind === 'action' &&
        buttonData.action.action === 'change'
      ) {
        await interaction.showModal(
          new ModalBuilder()
            .setCustomId(encodeModalId({ gameId }))
            .setTitle('Change your mines setup')
            .addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId(BET_INPUT_ID)
                  .setLabel('How much would you like to bet?')
                  .setPlaceholder('e.g. 100, 4k, 10.5k')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              ),
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId(MINES_INPUT_ID)
                  .setLabel('How many mines?')
                  .setPlaceholder('e.g. 3')
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
      const globalSettings = guildConfig?.globalSettings

      const game = await getMinesGameByGameId({ gameId, guildId })

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

      const sessionMessage = interaction.message
      if (!sessionMessage) return

      const showBalance = buttonData?.showBalance ?? game.showBalance

      const followUpError = async (title: string, description: string) => {
        if (!interaction.isRepliable()) return
        await interaction.followUp({
          embeds: [createErrorEmbed(title, description)],
          flags: MessageFlags.Ephemeral
        })
      }

      /** Deals a new board into the same session document / message. */
      const dealBoard = async (betAmount: number, mineCount: number) => {
        if (!guildConfig) {
          return followUpError(
            'Error - Missing Config',
            'Guild casino configuration was not found.'
          )
        }

        try {
          const board = await startMinesBoard({
            userId: game.userId,
            guildId: game.guildId,
            gameId: game.gameId,
            channelId: game.channelId,
            messageId: game.messageId,
            betAmount,
            mineCount,
            houseEdge: guildConfig.casinoSettings.mines.houseEdge,
            showBalance: game.showBalance,
            sessionStats: game.sessionStats,
            globalSettings: guildConfig.globalSettings
          })

          await sessionMessage.edit({
            content: null,
            embeds: board.embeds,
            components: board.components
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
        if (game.status !== 'RESULT' && game.status !== 'SETUP') {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Board In Progress',
              'Finish the current board before changing your setup.'
            )
          ])
          return
        }

        if (!guildConfig) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Missing Config',
              'Guild casino configuration was not found.'
            )
          ])
          return
        }

        const minesSettings = guildConfig.casinoSettings.mines
        const betAmount = parseReadableStringToNumber(
          interaction.fields.getTextInputValue(BET_INPUT_ID)
        )
        const mineCount = Number(
          interaction.fields.getTextInputValue(MINES_INPUT_ID)
        )

        const validation = validateBetAmount(
          betAmount,
          minesSettings.maxBet,
          minesSettings.minBet
        )
        if (!validation.ok) {
          await replyBetValidationError(
            interaction,
            validation.error,
            minesSettings.maxBet,
            minesSettings.minBet,
            guildConfig.globalSettings
          )
          return
        }

        if (
          !isValidMineCount(
            mineCount,
            minesSettings.minMines,
            minesSettings.maxMines
          )
        ) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Invalid Mines Count',
              `Choose between **${minesSettings.minMines}** and **${minesSettings.maxMines}** mines.`
            )
          ])
          return
        }

        await updateMinesGame({
          userId: game.userId,
          guildId: game.guildId,
          betAmount,
          mineCount,
          status: 'SETUP',
          activeBetId: null,
          mineIndices: [],
          revealedIndices: [],
          houseEdgeSnapshot: minesSettings.houseEdge
        })

        await sessionMessage.edit({
          content: null,
          embeds: [
            renderMinesSetupEmbed({
              gameId: game.gameId,
              betAmount,
              mineCount,
              globalSettings: guildConfig.globalSettings
            })
          ],
          components: renderMinesSetupComponents({
            gameId: game.gameId,
            showBalance: game.showBalance,
            canStart: true
          })
        })
        return
      }

      if (!buttonData) return

      if (buttonData.action.kind === 'action') {
        if (game.status !== 'RESULT' && game.status !== 'SETUP') {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Board In Progress',
              'Finish the current board first.'
            )
          ])
          return
        }

        if (buttonData.action.action === 'close') {
          await deleteMinesGame({
            userId: game.userId,
            guildId: game.guildId
          })

          await sessionMessage.edit({
            content: null,
            embeds: [
              formatSessionSummaryEmbed({
                gameLabel: 'Mines',
                emoji: '💣',
                stats: game.sessionStats,
                reason: 'closed',
                gameId: game.gameId,
                globalSettings,
                roundsLabel: 'Boards'
              })
            ],
            components: []
          })
          return
        }

        if (buttonData.action.action === 'change') return

        if (
          buttonData.action.action === 'start'
            ? game.status !== 'SETUP'
            : game.status !== 'RESULT'
        ) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Board In Progress',
              'Finish the current board first.'
            )
          ])
          return
        }

        const stake = game.betAmount
        const mines = game.mineCount
        if (stake == null || mines == null) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Setup Required',
              'Set your bet and mines before starting.'
            )
          ])
          return
        }

        await dealBoard(stake, mines)
        return
      }

      if (game.status !== 'ACTIVE' || !game.activeBetId) {
        await replyEphemeralError(interaction, [
          createErrorEmbed(
            'Error - Game not active',
            'This Mines game is no longer accepting actions.'
          )
        ])
        return
      }

      const engine = docToMinesEngine(game)
      const action = buttonData.action

      const finishGame = async () => {
        await finishMinesAndSettle({
          game,
          guildConfig,
          guild: interaction.guild,
          sourceChannelId: game.channelId,
          showBalance,
          message: sessionMessage
        })
      }

      if (action.kind === 'cashout') {
        const cash = cashOutPayout(engine)
        if (cash.kind === 'IGNORED') {
          return followUpError(
            'Error - Cannot Cash Out',
            cash.reason === 'NO_REVEALS'
              ? 'Reveal at least one safe tile before cashing out.'
              : 'This game is already finished.'
          )
        }

        game.status = 'RESULT'
        game.revealedIndices = engine.revealedIndices
        await saveMinesGame(game)

        await finishGame()
        return
      }

      const reveal = revealCell(engine, action.cellIndex)

      if (reveal.kind === 'IGNORED') {
        return followUpError(
          'Error - Invalid Move',
          reveal.reason === 'ALREADY_REVEALED'
            ? 'That tile is already revealed.'
            : 'That tile cannot be revealed.'
        )
      }

      game.revealedIndices = engine.revealedIndices
      game.status = engine.status

      if (reveal.kind === 'MINE') {
        await saveMinesGame(game)
        await finishGame()
        return
      }

      if (reveal.boardCleared) {
        const cash = cashOutPayout(engine)
        game.status = 'RESULT'
        game.revealedIndices = engine.revealedIndices
        await saveMinesGame(game)
        if (cash.kind === 'OK') {
          await finishGame()
        }
        return
      }

      await saveMinesGame(game)

      await sessionMessage.edit({
        embeds: [
          renderMinesEmbed({
            gameId: game.gameId,
            betAmount: engine.betAmount,
            mineCount: engine.mineCount,
            revealedCount: engine.revealedIndices.length,
            multiplier: reveal.multiplier,
            result: { kind: 'SAFE', multiplier: reveal.multiplier },
            showBalance,
            globalSettings
          })
        ],
        components: renderMinesButtons({
          gameId: game.gameId,
          state: engine,
          showBalance
        })
      })
    } catch (err) {
      await handleUnexpectedButtonError(interaction, err, {
        handler: 'handleMines'
      })
    }
  })
}
