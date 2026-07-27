import { validateBetAmount } from 'gambling-bot-shared/casino'
import {
  formatMoney,
  parseReadableStringToNumber
} from 'gambling-bot-shared/common'
import type { GlobalSettings } from 'gambling-bot-shared/guild'
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
  deleteSlotsGame,
  getGuildConfigByGuildId,
  getSlotsGameByGameId,
  getUser,
  updateSlotsGame
} from '@/services'
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

const AMOUNT_INPUT_ID = 'amount'

type MoneySettings = Partial<GlobalSettings> | null | undefined

const replyBetValidationError = async (
  interaction: Interaction,
  error: string,
  maxBet: number,
  minBet: number,
  globalSettings: MoneySettings
) => {
  if (!interaction.isRepliable()) return

  const embeds = (() => {
    switch (error) {
      case 'INVALID_NUMBER':
        return [
          createErrorEmbed('Invalid Input', 'Bet must be a valid number.')
        ]
      case 'TOO_MANY_DECIMALS':
        return [
          createErrorEmbed(
            'Invalid Bet Amount',
            'Bet must have at most 2 decimal places.'
          )
        ]
      case 'BELOW_MINIMUM':
        return [
          createErrorEmbed(
            'Invalid Bet Amount',
            'Minimum possible bet is **$1**.'
          )
        ]
      case 'ABOVE_MAXIMUM':
        return [
          createErrorEmbed(
            'Invalid Bet Amount',
            `Maximum bet is **${formatMoney(maxBet, globalSettings)}**.`
          )
        ]
      case 'BELOW_MIN_BET':
        return [
          createErrorEmbed(
            'Invalid Bet Amount',
            `Minimum bet is **${formatMoney(minBet, globalSettings)}**.`
          )
        ]
      default:
        return [
          createErrorEmbed('Invalid Bet Amount', 'Bet amount is invalid.')
        ]
    }
  })()

  await interaction.reply({ embeds, flags: MessageFlags.Ephemeral })
}

const showBetModal = async (interaction: Interaction, gameId: string) => {
  if (!interaction.isMessageComponent()) return

  const modal = new ModalBuilder()
    .setCustomId(encodeModalId({ gameId, target: 'bet' }))
    .setTitle('Change slots bet')

  const amountInput = new TextInputBuilder()
    .setCustomId(AMOUNT_INPUT_ID)
    .setLabel('Chip amount (per spin)')
    .setPlaceholder('e.g. 100, 4k, 10.5k')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput)
  )

  await interaction.showModal(modal)
}

export default async (interaction: Interaction) => {
  const isButton = interaction.isButton()
  const isSelect = interaction.isStringSelectMenu()
  const isModal = interaction.isModalSubmit()

  if (!isButton && !isSelect && !isModal) return

  const guildId = interaction.guildId
  if (!guildId) return

  try {
    if (isModal) {
      const modalData = decodeModalId(interaction.customId)
      if (!modalData) return

      const game = await getSlotsGameByGameId({
        gameId: modalData.gameId,
        guildId
      })

      if (!game) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Invalid Game',
              'This slots machine no longer exists.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      if (interaction.user.id !== game.userId) {
        return interaction.reply({
          embeds: [
            createErrorEmbed('Invalid Input', 'This is not your machine.')
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      if (game.phase === 'spinning' || game.activeBetId) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Machine Busy',
              'This slots batch is still being finished. Please wait a moment.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const guildConfig = await getGuildConfigByGuildId({ guildId })
      if (!guildConfig) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Missing Config',
              'Guild casino configuration was not found.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const amountRaw = interaction.fields.getTextInputValue(AMOUNT_INPUT_ID)
      const unitBet = parseReadableStringToNumber(amountRaw)

      if (!Number.isFinite(unitBet) || unitBet <= 0) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid Input - Amount',
              'Please enter a valid positive amount.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const validation = validateBetAmount(
        unitBet,
        guildConfig.casinoSettings.slots.maxBet,
        guildConfig.casinoSettings.slots.minBet
      )
      if (!validation.ok) {
        await replyBetValidationError(
          interaction,
          validation.error,
          guildConfig.casinoSettings.slots.maxBet,
          guildConfig.casinoSettings.slots.minBet,
          guildConfig.globalSettings
        )
        return
      }

      await interaction.deferUpdate()

      const updated = await updateSlotsGame({
        userId: game.userId,
        guildId: game.guildId,
        unitBet,
        phase: game.phase === 'result' ? 'result' : 'ready'
      })

      if (!updated || !interaction.message) return

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

    const data = decodeId(interaction.customId)
    if (!data) return

    const guildConfig = await getGuildConfigByGuildId({ guildId })
    if (!guildConfig) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Missing Config',
            'Guild casino configuration was not found.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const game = await getSlotsGameByGameId({
      gameId: data.gameId,
      guildId
    })

    if (!game) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Invalid Game',
            'This slots machine no longer exists.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (interaction.user.id !== game.userId) {
      return interaction.reply({
        embeds: [
          createErrorEmbed('Invalid Input', 'This is not your machine.')
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (game.phase === 'spinning' || game.activeBetId) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Machine Busy',
            'This slots batch is still being finished. Please wait a moment.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const user = await getUser({
      userId: game.userId,
      guildId
    })

    if (!user) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Missing User',
            'Your casino profile was not found.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (isUserBanned(user)) {
      return interaction.reply({
        embeds: [createErrorEmbed(USER_BANNED_ERROR, USER_BANNED_MESSAGE)],
        flags: MessageFlags.Ephemeral
      })
    }

    if (data.kind === 'select') {
      if (!isSelect) return

      const spinsCount = parseSpinsCount(interaction.values[0] ?? '')
      if (spinsCount == null) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Invalid Spins',
              'Pick a spin count between 1 and 10.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      await interaction.deferUpdate()

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

    if (data.action === 'changeBet') {
      await showBetModal(interaction, game.gameId)
      return
    }

    if (data.action === 'close') {
      await interaction.deferUpdate()
      await deleteSlotsGame({
        userId: game.userId,
        guildId: game.guildId
      })
      await interaction.message.edit({
        embeds: [renderSlotsClosedEmbed()],
        components: []
      })
      return
    }

    if (data.action === 'spin') {
      if (game.unitBet == null) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'No Chip Set',
              'Set your chip with Change bet before spinning.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const validation = validateBetAmount(
        game.unitBet,
        guildConfig.casinoSettings.slots.maxBet,
        guildConfig.casinoSettings.slots.minBet
      )
      if (!validation.ok) {
        await replyBetValidationError(
          interaction,
          validation.error,
          guildConfig.casinoSettings.slots.maxBet,
          guildConfig.casinoSettings.slots.minBet,
          guildConfig.globalSettings
        )
        return
      }

      await interaction.deferUpdate()

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
        if (error instanceof Error && error.message === 'INSUFFICIENT_FUNDS') {
          await interaction.followUp({
            embeds: [
              createErrorEmbed(
                'Bet Failed',
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
}
