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
  deletePlinkoGame,
  getGuildConfigByGuildId,
  getPlinkoGameByGameId,
  getUser,
  updatePlinkoGame
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
  parseDropBalls,
  playPlinkoRound,
  renderPlinkoBoardEmbed,
  renderPlinkoClosedEmbed,
  renderPlinkoComponents
} from '@/utils/casino/plinko'
import { createErrorEmbed } from '@/utils/discord/createEmbed'
import { deferComponentUpdate } from '@/utils/discord/deferComponentUpdate'

const AMOUNT_INPUT_ID = 'amount'

const showBetModal = async (interaction: Interaction, gameId: string) => {
  if (!interaction.isMessageComponent()) return

  const modal = new ModalBuilder()
    .setCustomId(encodeModalId({ gameId, target: 'bet' }))
    .setTitle('Change Plinko bet')

  const amountInput = new TextInputBuilder()
    .setCustomId(AMOUNT_INPUT_ID)
    .setLabel('Bet amount')
    .setPlaceholder('e.g. 100, 4k, 10.5k')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput)
  )

  await interaction.showModal(modal)
}

export const handlePlinkoInteraction = async (interaction: Interaction) => {
  const isButton = interaction.isButton()
  const isModal = interaction.isModalSubmit()

  if (!isButton && !isModal) return

  const customId = interaction.customId
  if (!customId.startsWith('pk:') && !customId.startsWith('pkm:')) return

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

        const game = await getPlinkoGameByGameId({
          gameId: modalData.gameId,
          guildId
        })

        if (!game) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Invalid Game',
              'This Plinko board no longer exists.'
            )
          ])
          return
        }

        if (interaction.user.id !== game.userId) {
          await replyEphemeralError(interaction, [
            createErrorEmbed('Error - Invalid Input', 'This is not your board.')
          ])
          return
        }

        if (game.phase === 'dropping' || game.activeBetId) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Board Busy',
              'This drop is still being finished. Please wait a moment.'
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

        const plinkoSettings = guildConfig.casinoSettings.plinko
        const validation = validateBetAmount(
          unitBet,
          plinkoSettings.maxBet,
          plinkoSettings.minBet
        )
        if (!validation.ok) {
          await replyBetValidationError(
            interaction,
            validation.error,
            plinkoSettings.maxBet,
            plinkoSettings.minBet,
            guildConfig.globalSettings
          )
          return
        }

        const updated = await updatePlinkoGame({
          userId: game.userId,
          guildId: game.guildId,
          unitBet,
          phase: 'ready'
        })
        if (!updated || !interaction.message) return

        await interaction.message.edit({
          embeds: [
            renderPlinkoBoardEmbed({
              gameId: game.gameId,
              phase: updated.phase,
              unitBet: updated.unitBet,
              showBalance: game.showBalance,
              globalSettings: guildConfig.globalSettings,
              binMultipliers: guildConfig.casinoSettings.plinko.binMultipliers
            })
          ],
          components: renderPlinkoComponents({
            gameId: game.gameId,
            phase: updated.phase,
            hasUnitBet: updated.unitBet != null
          })
        })
        return
      }

      const data = decodeId(customId)
      if (!data || data.kind !== 'action') return

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

      const game = await getPlinkoGameByGameId({
        gameId: data.gameId,
        guildId
      })

      if (!game) {
        await replyEphemeralError(interaction, [
          createErrorEmbed(
            'Error - Invalid Game',
            'This Plinko board no longer exists.'
          )
        ])
        return
      }

      if (interaction.user.id !== game.userId) {
        await replyEphemeralError(interaction, [
          createErrorEmbed('Error - Invalid Input', 'This is not your board.')
        ])
        return
      }

      if (game.phase === 'dropping' || game.activeBetId) {
        await replyEphemeralError(interaction, [
          createErrorEmbed(
            'Error - Board Busy',
            'This drop is still being finished. Please wait a moment.'
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

      if (data.action === 'close') {
        await deletePlinkoGame({
          userId: game.userId,
          guildId: game.guildId
        })
        await interaction.message.edit({
          embeds: [
            renderPlinkoClosedEmbed({
              stats: game.sessionStats,
              gameId: game.gameId
            })
          ],
          components: []
        })
        return
      }

      const ballsCount = parseDropBalls(data.action)
      if (ballsCount == null) return

      if (game.unitBet == null) {
        await replyEphemeralError(interaction, [
          createErrorEmbed(
            'Error - No Bet Set',
            'Set your bet with Change bet before dropping.'
          )
        ])
        return
      }

      const plinkoSettings = guildConfig.casinoSettings.plinko
      const validation = validateBetAmount(
        game.unitBet,
        plinkoSettings.maxBet,
        plinkoSettings.minBet
      )
      if (!validation.ok) {
        await replyBetValidationError(
          interaction,
          validation.error,
          plinkoSettings.maxBet,
          plinkoSettings.minBet,
          guildConfig.globalSettings
        )
        return
      }

      try {
        await playPlinkoRound({
          message: interaction.message,
          userId: game.userId,
          guildId: game.guildId,
          gameId: game.gameId,
          unitBet: game.unitBet,
          ballsCount,
          showBalance: game.showBalance,
          skipAnimations: game.skipAnimations,
          previousPhase: game.phase === 'result' ? 'result' : 'ready',
          guild: interaction.guild,
          guildConfig,
          sourceChannelId: interaction.channelId
        })
      } catch (error) {
        if (error instanceof Error && error.message === 'INSUFFICIENT_FUNDS') {
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
    } catch (error) {
      await handleUnexpectedButtonError(interaction, error, {
        handler: 'handlePlinko'
      })
    }
  })
}
