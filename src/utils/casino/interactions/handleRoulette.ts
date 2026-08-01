import { validateBetAmount } from 'gambling-bot-shared/casino'
import { parseReadableStringToNumber } from 'gambling-bot-shared/common'
import { USER_BANNED_MESSAGE, isUserBanned } from 'gambling-bot-shared/user'

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
  deleteRouletteGame,
  getGuildConfigByGuildId,
  getRouletteGameByGameId,
  getUser,
  updateRouletteGame
} from '@/services'
import { runWithQuestNotifyInteraction } from '@/services/quests'
import {
  replyBetValidationError,
  replyEphemeralError
} from '@/utils/casino/betValidationReply'
import {
  ROULETTE_MAX_SLIP_BETS,
  buildSlipBet,
  decodeId,
  decodeModalId,
  encodeModalId,
  mergeSlipBet,
  playRouletteSpin,
  renderRouletteClosedEmbed,
  renderRouletteComponents,
  renderRouletteTableEmbed,
  slipTotal
} from '@/utils/casino/roulette'
import { createErrorEmbed } from '@/utils/discord/createEmbed'
import { deferComponentUpdate } from '@/utils/discord/deferComponentUpdate'

const AMOUNT_INPUT_ID = 'amount'

const showAmountModal = async (
  interaction: Interaction,
  gameId: string,
  target: string,
  label: string
) => {
  if (!interaction.isMessageComponent()) return

  const modal = new ModalBuilder()
    .setCustomId(encodeModalId({ gameId, target }))
    .setTitle(`Bet on ${label}`.slice(0, 45))

  const amountInput = new TextInputBuilder()
    .setCustomId(AMOUNT_INPUT_ID)
    .setLabel('How much would you like to bet?')
    .setPlaceholder('e.g. 100, 4k, 10.5k')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput)
  )

  await interaction.showModal(modal)
}

export const handleRouletteInteraction = async (interaction: Interaction) => {
  const isButton = interaction.isButton()
  const isSelect = interaction.isStringSelectMenu()
  const isModal = interaction.isModalSubmit()

  if (!isButton && !isSelect && !isModal) return

  const customId = interaction.customId
  if (!customId.startsWith('rl:') && !customId.startsWith('rlm:')) return

  return runWithQuestNotifyInteraction(interaction, async () => {
    const guildId = interaction.guildId
    if (!guildId) return

    try {
      if (isModal) {
        const modalData = decodeModalId(interaction.customId)
        if (!modalData) return

        if (!(await deferComponentUpdate(interaction))) return

        const game = await getRouletteGameByGameId({
          gameId: modalData.gameId,
          guildId
        })

        if (!game) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Invalid Game',
              'This roulette table no longer exists.'
            )
          ])
          return
        }

        if (interaction.user.id !== game.userId) {
          await replyEphemeralError(interaction, [
            createErrorEmbed('Error - Invalid Input', 'This is not your table.')
          ])
          return
        }

        if (game.phase !== 'betting') {
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

        const amountRaw = interaction.fields.getTextInputValue(AMOUNT_INPUT_ID)
        const amount = parseReadableStringToNumber(amountRaw)

        if (!Number.isFinite(amount) || amount <= 0) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Invalid Input - Amount',
              'Please enter a valid positive amount.'
            )
          ])
          return
        }

        let nextBet
        try {
          nextBet = buildSlipBet(modalData.target, amount)
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Invalid bet target.'
          await replyEphemeralError(interaction, [
            createErrorEmbed('Error - Invalid Input - Bet', message)
          ])
          return
        }

        const merged = mergeSlipBet(game.bets, nextBet)
        if (
          merged.length > ROULETTE_MAX_SLIP_BETS &&
          merged.length > game.bets.length
        ) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Slip Full',
              `You can place at most **${ROULETTE_MAX_SLIP_BETS}** different bets on one spin.`
            )
          ])
          return
        }

        const total = slipTotal(merged)
        const validation = validateBetAmount(
          total,
          guildConfig.casinoSettings.roulette.maxBet,
          guildConfig.casinoSettings.roulette.minBet
        )
        if (!validation.ok) {
          await replyBetValidationError(
            interaction,
            validation.error,
            guildConfig.casinoSettings.roulette.maxBet,
            guildConfig.casinoSettings.roulette.minBet,
            guildConfig.globalSettings
          )
          return
        }

        const updated = await updateRouletteGame({
          userId: game.userId,
          guildId: game.guildId,
          bets: merged,
          phase: 'betting'
        })

        if (!updated || !interaction.message) return

        await interaction.message.edit({
          embeds: [
            renderRouletteTableEmbed({
              gameId: game.gameId,
              bets: updated.bets,
              phase: 'betting',
              showBalance: game.showBalance,
              globalSettings: guildConfig.globalSettings
            })
          ],
          components: renderRouletteComponents({
            gameId: game.gameId,
            phase: 'betting',
            hasBets: updated.bets.length > 0,
            hasLastBets: updated.lastBets.length > 0
          })
        })
        return
      }

      const data = decodeId(interaction.customId)
      if (!data) return

      // place / select open a modal - showModal must be the first response.
      if (data.kind === 'place' || data.kind === 'select') {
        if (data.kind === 'place') {
          await showAmountModal(
            interaction,
            data.gameId,
            data.target,
            data.target.toUpperCase()
          )
          return
        }

        if (!isSelect) return
        const value = interaction.values[0]
        if (!value) return

        const labels: Record<string, string> = {
          d1: 'Dozen 1',
          d2: 'Dozen 2',
          d3: 'Dozen 3',
          c1: 'Column 1',
          c2: 'Column 2',
          c3: 'Column 3'
        }

        await showAmountModal(
          interaction,
          data.gameId,
          value,
          labels[value] ?? `Number ${value}`
        )
        return
      }

      // Acknowledge spin / close / slip edits immediately before any DB work.
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

      const game = await getRouletteGameByGameId({
        gameId: data.gameId,
        guildId
      })

      if (!game) {
        await replyEphemeralError(interaction, [
          createErrorEmbed(
            'Error - Invalid Game',
            'This roulette table no longer exists.'
          )
        ])
        return
      }

      if (interaction.user.id !== game.userId) {
        await replyEphemeralError(interaction, [
          createErrorEmbed('Error - Invalid Input', 'This is not your table.')
        ])
        return
      }

      const user = await getUser({
        userId: game.userId,
        guildId
      })

      if (!user) {
        await replyEphemeralError(interaction, [
          createErrorEmbed(
            'Error - Missing User',
            'Your casino profile was not found.'
          )
        ])
        return
      }

      if (isUserBanned(user)) {
        await replyEphemeralError(interaction, [
          createErrorEmbed('Error - Account Restricted', USER_BANNED_MESSAGE)
        ])
        return
      }

      if (data.kind !== 'action') return

      const editTable = async ({
        bets,
        phase,
        lastBets,
        lastSpinResult,
        lastNetResult,
        finalBalance
      }: {
        bets: typeof game.bets
        phase: 'betting' | 'result'
        lastBets: typeof game.lastBets
        lastSpinResult?: string | null
        lastNetResult?: number | null
        finalBalance?: number
      }) => {
        await interaction.message.edit({
          embeds: [
            renderRouletteTableEmbed({
              gameId: game.gameId,
              bets: phase === 'result' ? lastBets : bets,
              phase,
              lastSpinResult,
              lastNetResult,
              showBalance: game.showBalance,
              finalBalance,
              globalSettings: guildConfig.globalSettings
            })
          ],
          components: renderRouletteComponents({
            gameId: game.gameId,
            phase,
            hasBets: bets.length > 0,
            hasLastBets: lastBets.length > 0
          })
        })
      }

      if (data.action === 'close') {
        await deleteRouletteGame({
          userId: game.userId,
          guildId: game.guildId
        })
        await interaction.message.edit({
          embeds: [
            renderRouletteClosedEmbed({
              stats: game.sessionStats,
              gameId: game.gameId
            })
          ],
          components: []
        })
        return
      }

      if (data.action === 'change') {
        if (game.phase === 'spinning') {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Table Busy',
              'This roulette spin is still being finished. Please wait a moment.'
            )
          ])
          return
        }

        const updated = await updateRouletteGame({
          userId: game.userId,
          guildId: game.guildId,
          phase: 'betting',
          bets: [],
          lastSpinResult: null,
          lastNetResult: null
        })
        if (!updated) return

        await editTable({
          bets: [],
          phase: 'betting',
          lastBets: updated.lastBets
        })
        return
      }

      if (data.action === 'undo') {
        if (game.phase !== 'betting' || game.bets.length === 0) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Nothing to Undo',
              'Your slip is already empty.'
            )
          ])
          return
        }

        const updated = await updateRouletteGame({
          userId: game.userId,
          guildId: game.guildId,
          bets: game.bets.slice(0, -1)
        })
        if (!updated) return

        await editTable({
          bets: updated.bets,
          phase: 'betting',
          lastBets: updated.lastBets
        })
        return
      }

      if (data.action === 'clear') {
        if (game.phase !== 'betting') {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Table Busy',
              'Use Change bets from the result view first.'
            )
          ])
          return
        }

        const updated = await updateRouletteGame({
          userId: game.userId,
          guildId: game.guildId,
          bets: []
        })
        if (!updated) return

        await editTable({
          bets: [],
          phase: 'betting',
          lastBets: updated.lastBets
        })
        return
      }

      if (data.action === 'spin' || data.action === 'rebet') {
        if (game.phase === 'spinning') {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Table Busy',
              'This roulette spin is still being finished. Please wait a moment.'
            )
          ])
          return
        }

        const slip =
          data.action === 'rebet'
            ? game.lastBets
            : game.phase === 'betting'
              ? game.bets
              : []

        if (slip.length === 0) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              data.action === 'rebet'
                ? 'Error - Nothing to Rebet'
                : 'Error - Empty Slip',
              data.action === 'rebet'
                ? 'There is no previous slip to rebet.'
                : 'Add at least one bet before spinning.'
            )
          ])
          return
        }

        const total = slipTotal(slip)
        const validation = validateBetAmount(
          total,
          guildConfig.casinoSettings.roulette.maxBet,
          guildConfig.casinoSettings.roulette.minBet
        )
        if (!validation.ok) {
          await replyBetValidationError(
            interaction,
            validation.error,
            guildConfig.casinoSettings.roulette.maxBet,
            guildConfig.casinoSettings.roulette.minBet,
            guildConfig.globalSettings
          )
          return
        }

        try {
          await playRouletteSpin({
            message: interaction.message,
            userId: game.userId,
            guildId: game.guildId,
            gameId: game.gameId,
            bets: slip,
            showBalance: game.showBalance,
            skipAnimations: game.skipAnimations,
            guild: interaction.guild,
            guildConfig,
            sourceChannelId: interaction.channelId
          })
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === 'INSUFFICIENT_FUNDS'
          ) {
            await interaction.followUp({
              embeds: [
                createErrorEmbed(
                  'Error - Bet Failed',
                  'Not enough balance to place this bet.'
                )
              ],
              flags: MessageFlags.Ephemeral
            })
            return
          }
          throw error
        }
      }
    } catch (error) {
      await handleUnexpectedButtonError(interaction, error, {
        handler: 'handleRoulette'
      })
    }
  })
}
