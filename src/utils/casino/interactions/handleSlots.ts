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
  deleteSlotsGame,
  getGuildConfigByGuildId,
  getSlotsGameByGameId,
  getUser,
  updateSlotsGame
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
  parseSpinsCount,
  playSlotsRound,
  renderSlotsClosedEmbed,
  renderSlotsComponents,
  renderSlotsMachineEmbed
} from '@/utils/casino/slots'
import { createErrorEmbed } from '@/utils/discord/createEmbed'
import { deferComponentUpdate } from '@/utils/discord/deferComponentUpdate'

const AMOUNT_INPUT_ID = 'amount'

const showBetModal = async (interaction: Interaction, gameId: string) => {
  if (!interaction.isMessageComponent()) return

  const modal = new ModalBuilder()
    .setCustomId(encodeModalId({ gameId, target: 'bet' }))
    .setTitle('Change slots bet')

  const amountInput = new TextInputBuilder()
    .setCustomId(AMOUNT_INPUT_ID)
    .setLabel('Bet amount (per spin)')
    .setPlaceholder('e.g. 100, 4k, 10.5k')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput)
  )

  await interaction.showModal(modal)
}

export const handleSlotsInteraction = async (interaction: Interaction) => {
  const isButton = interaction.isButton()
  const isSelect = interaction.isStringSelectMenu()
  const isModal = interaction.isModalSubmit()

  if (!isButton && !isSelect && !isModal) return

  const customId = interaction.customId
  if (!customId.startsWith('sl:') && !customId.startsWith('slm:')) return

  // Change-bet must showModal as the first response (cannot defer first).
  if (isButton) {
    const buttonData = decodeId(customId)
    if (buttonData?.kind === 'action' && buttonData.action === 'changeBet') {
      await showBetModal(interaction, buttonData.gameId)
      return
    }
  }

  // Acknowledge immediately - Discord expires interactions in ~3s.
  const acked = await deferComponentUpdate(interaction)
  if (!acked) return

  return runWithQuestNotifyInteraction(interaction, async () => {
    const guildId = interaction.guildId
    if (!guildId) return

    try {
      if (isModal) {
        const modalData = decodeModalId(customId)
        if (!modalData) return

        const game = await getSlotsGameByGameId({
          gameId: modalData.gameId,
          guildId
        })

        if (!game) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Invalid Game',
              'This slots machine no longer exists.'
            )
          ])
          return
        }

        if (interaction.user.id !== game.userId) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Invalid Input',
              'This is not your machine.'
            )
          ])
          return
        }

        if (game.phase === 'spinning' || game.activeBetId) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Machine Busy',
              'This slots batch is still being finished. Please wait a moment.'
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

        const unitBet = parseReadableStringToNumber(
          interaction.fields.getTextInputValue(AMOUNT_INPUT_ID)
        )
        if (!Number.isFinite(unitBet) || unitBet <= 0) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Invalid Input - Amount',
              'Please enter a valid positive amount.'
            )
          ])
          return
        }

        const slotsSettings = guildConfig.casinoSettings.slots
        const validation = validateBetAmount(
          unitBet,
          slotsSettings.maxBet,
          slotsSettings.minBet
        )
        if (!validation.ok) {
          await replyBetValidationError(
            interaction,
            validation.error,
            slotsSettings.maxBet,
            slotsSettings.minBet,
            guildConfig.globalSettings
          )
          return
        }

        const updated = await updateSlotsGame({
          userId: game.userId,
          guildId: game.guildId,
          unitBet,
          phase: 'ready'
        })
        if (!updated || !interaction.message) return

        await interaction.message.edit({
          embeds: [
            renderSlotsMachineEmbed({
              gameId: game.gameId,
              phase: updated.phase,
              unitBet: updated.unitBet,
              spinsCount: updated.spinsCount,
              showBalance: game.showBalance,
              globalSettings: guildConfig.globalSettings
            })
          ],
          components: renderSlotsComponents({
            gameId: game.gameId,
            phase: updated.phase,
            hasUnitBet: updated.unitBet != null,
            spinsCount: updated.spinsCount
          })
        })
        return
      }

      const data = decodeId(customId)
      if (!data) return

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

      const game = await getSlotsGameByGameId({
        gameId: data.gameId,
        guildId
      })

      if (!game) {
        await replyEphemeralError(interaction, [
          createErrorEmbed(
            'Error - Invalid Game',
            'This slots machine no longer exists.'
          )
        ])
        return
      }

      if (interaction.user.id !== game.userId) {
        await replyEphemeralError(interaction, [
          createErrorEmbed('Error - Invalid Input', 'This is not your machine.')
        ])
        return
      }

      if (game.phase === 'spinning' || game.activeBetId) {
        await replyEphemeralError(interaction, [
          createErrorEmbed(
            'Error - Machine Busy',
            'This slots batch is still being finished. Please wait a moment.'
          )
        ])
        return
      }

      const user = await getUser({
        userId: interaction.user.id,
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

      if (data.kind === 'select') {
        if (!isSelect) return

        const spinsCount = parseSpinsCount(interaction.values[0] ?? '')
        if (spinsCount == null) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Invalid Spins',
              'Pick a spin count between 1 and 10.'
            )
          ])
          return
        }

        const updated = await updateSlotsGame({
          userId: game.userId,
          guildId: game.guildId,
          spinsCount
        })
        if (!updated) return

        await interaction.message.edit({
          embeds: [
            renderSlotsMachineEmbed({
              gameId: game.gameId,
              phase: updated.phase,
              unitBet: updated.unitBet,
              spinsCount: updated.spinsCount,
              lastNetResult: updated.lastNetResult,
              lastSpinsCount: updated.lastSpinsCount,
              lastTotalBet: updated.lastTotalBet,
              lastWinsCount: updated.lastWinsCount,
              showBalance: game.showBalance,
              globalSettings: guildConfig.globalSettings
            })
          ],
          components: renderSlotsComponents({
            gameId: game.gameId,
            phase: updated.phase,
            hasUnitBet: updated.unitBet != null,
            spinsCount: updated.spinsCount
          })
        })
        return
      }

      if (data.kind !== 'action') return

      if (data.action === 'close') {
        await deleteSlotsGame({
          userId: game.userId,
          guildId: game.guildId
        })
        await interaction.message.edit({
          embeds: [
            renderSlotsClosedEmbed({
              stats: game.sessionStats,
              gameId: game.gameId
            })
          ],
          components: []
        })
        return
      }

      if (data.action === 'spin') {
        if (game.unitBet == null) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - No Bet Set',
              'Set your bet with Change bet before spinning.'
            )
          ])
          return
        }

        const slotsSettings = guildConfig.casinoSettings.slots
        const validation = validateBetAmount(
          game.unitBet,
          slotsSettings.maxBet,
          slotsSettings.minBet
        )
        if (!validation.ok) {
          await replyBetValidationError(
            interaction,
            validation.error,
            slotsSettings.maxBet,
            slotsSettings.minBet,
            guildConfig.globalSettings
          )
          return
        }

        try {
          await playSlotsRound({
            message: interaction.message,
            userId: game.userId,
            guildId: game.guildId,
            gameId: game.gameId,
            unitBet: game.unitBet,
            spinsCount: game.spinsCount,
            showBalance: game.showBalance,
            skipAnimations: game.skipAnimations,
            previousPhase: game.phase === 'result' ? 'result' : 'ready',
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
        handler: 'handleSlots'
      })
    }
  })
}
