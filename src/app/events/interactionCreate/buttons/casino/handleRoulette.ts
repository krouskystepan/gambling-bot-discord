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
  deleteRouletteGame,
  getGuildConfigByGuildId,
  getRouletteGameByGameId,
  getUser,
  updateRouletteGame
} from '@/services'
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

      const game = await getRouletteGameByGameId({
        gameId: modalData.gameId,
        guildId
      })

      if (!game) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Invalid Game',
              'This roulette table no longer exists.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      if (interaction.user.id !== game.userId) {
        return interaction.reply({
          embeds: [
            createErrorEmbed('Invalid Input', 'This is not your table.')
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      if (game.phase !== 'betting') {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Table Busy',
              'Finish or change bets from the result buttons first.'
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
      const amount = parseReadableStringToNumber(amountRaw)

      if (!Number.isFinite(amount) || amount <= 0) {
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

      let nextBet
      try {
        nextBet = buildSlipBet(modalData.target, amount)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Invalid bet target.'
        return interaction.reply({
          embeds: [createErrorEmbed('Invalid Input - Bet', message)],
          flags: MessageFlags.Ephemeral
        })
      }

      const merged = mergeSlipBet(game.bets, nextBet)
      if (
        merged.length > ROULETTE_MAX_SLIP_BETS &&
        merged.length > game.bets.length
      ) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Slip Full',
              `You can place at most **${ROULETTE_MAX_SLIP_BETS}** different bets on one spin.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
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

      await interaction.deferUpdate()

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

    const game = await getRouletteGameByGameId({
      gameId: data.gameId,
      guildId
    })

    if (!game) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Invalid Game',
            'This roulette table no longer exists.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (interaction.user.id !== game.userId) {
      return interaction.reply({
        embeds: [createErrorEmbed('Invalid Input', 'This is not your table.')],
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

    if (data.kind === 'place') {
      if (game.phase !== 'betting') {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Table Busy',
              'Use Change bets before placing a new slip.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      await showAmountModal(
        interaction,
        game.gameId,
        data.target,
        data.target.toUpperCase()
      )
      return
    }

    if (data.kind === 'select') {
      if (!isSelect) return

      if (game.phase !== 'betting') {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Table Busy',
              'Use Change bets before placing a new slip.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

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
        game.gameId,
        value,
        labels[value] ?? `Number ${value}`
      )
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
      await interaction.deferUpdate()
      await deleteRouletteGame({
        userId: game.userId,
        guildId: game.guildId
      })
      await interaction.message.edit({
        embeds: [renderRouletteClosedEmbed()],
        components: []
      })
      return
    }

    if (data.action === 'change') {
      await interaction.deferUpdate()
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
        return interaction.reply({
          embeds: [
            createErrorEmbed('Nothing to Undo', 'Your slip is already empty.')
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      await interaction.deferUpdate()
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
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Table Busy',
              'Use Change bets from the result view first.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      await interaction.deferUpdate()
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
      const slip =
        data.action === 'rebet'
          ? game.lastBets
          : game.phase === 'betting'
            ? game.bets
            : []

      if (slip.length === 0) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              data.action === 'rebet' ? 'Nothing to Rebet' : 'Empty Slip',
              data.action === 'rebet'
                ? 'There is no previous slip to rebet.'
                : 'Add at least one bet before spinning.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
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

      await interaction.deferUpdate()

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
      handler: 'handleRoulette'
    })
  }
}
