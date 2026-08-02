import {
  isBlackjackPairsEnabled,
  isBlackjackPlusThreeEnabled,
  validateBetAmount
} from 'gambling-bot-shared/casino'
import {
  parseReadableStringToNumber,
  sessionBetId
} from 'gambling-bot-shared/common'
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
  deleteBlackjackGame,
  getBlackjackGameByGameId,
  getGuildConfigByGuildId,
  reserveCasinoBet,
  saveBlackjackGame,
  updateBlackjackGame
} from '@/services'
import { runWithQuestNotifyInteraction } from '@/services/quests'
import {
  replyBetValidationError,
  replyEphemeralError
} from '@/utils/casino/betValidationReply'
import {
  applyAction,
  calculateHandValue,
  canSplit,
  dealerDrawOne,
  dealerShouldDraw,
  decodeId,
  decodeModalId,
  docToEngine,
  encodeModalId,
  engineToDoc,
  finishBlackjackDealerAndSettle,
  renderBlackjackBettingComponents,
  renderBlackjackBettingEmbed,
  renderBlackjackButtons,
  renderBlackjackEmbed,
  resolveBlackjackInsuranceDecision,
  startBlackjackHand
} from '@/utils/casino/blackjack'
import { formatSessionSummaryEmbed } from '@/utils/casino/sessionSummary'
import { createErrorEmbed } from '@/utils/discord/createEmbed'
import { deferComponentUpdate } from '@/utils/discord/deferComponentUpdate'

const AMOUNT_INPUT_ID = 'amount'
const PAIRS_INPUT_ID = 'pairs'
const PLUS_THREE_INPUT_ID = 'plusThree'

/** Same Interaction object can hit parallel CommandKit listeners; handle once. */
const inFlightBlackjackInteractions = new WeakSet<object>()

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

const buildBlackjackBetModal = ({
  gameId,
  pairsEnabled,
  plusThreeEnabled
}: {
  gameId: string
  pairsEnabled: boolean
  plusThreeEnabled: boolean
}) => {
  const modal = new ModalBuilder()
    .setCustomId(encodeModalId({ gameId }))
    .setTitle('Change your blackjack bet')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(AMOUNT_INPUT_ID)
          .setLabel('Main bet amount')
          .setPlaceholder('e.g. 100, 4k, 10.5k')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    )

  if (pairsEnabled) {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(PAIRS_INPUT_ID)
          .setLabel('Perfect Pairs bet (optional)')
          .setPlaceholder('0 or empty for none')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
      )
    )
  }

  if (plusThreeEnabled) {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(PLUS_THREE_INPUT_ID)
          .setLabel('21+3 bet (optional)')
          .setPlaceholder('0 or empty for none')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
      )
    )
  }

  return modal
}

export const handleBlackjackInteraction = async (interaction: Interaction) => {
  const isButton = interaction.isButton()
  const isModal = interaction.isModalSubmit()

  if (!isButton && !isModal) return

  const customId = interaction.customId
  if (!customId.startsWith('bj:') && !customId.startsWith('bjm:')) return

  if (inFlightBlackjackInteractions.has(interaction)) return
  inFlightBlackjackInteractions.add(interaction)

  return runWithQuestNotifyInteraction(interaction, async () => {
    const modalData = isModal ? decodeModalId(interaction.customId) : null
    const buttonData = isButton ? decodeId(interaction.customId) : null
    const gameId = modalData?.gameId ?? buttonData?.gameId
    if (!gameId) return

    const guildId = interaction.guildId
    if (!guildId) return

    try {
      // showModal must be the first response - load config only for field flags.
      if (isButton && buttonData?.action === 'CHANGE') {
        const guildConfig = await getGuildConfigByGuildId({ guildId })
        const blackjack = guildConfig?.casinoSettings.blackjack
        await interaction.showModal(
          buildBlackjackBetModal({
            gameId,
            pairsEnabled: isBlackjackPairsEnabled(blackjack?.pairsMultipliers),
            plusThreeEnabled: isBlackjackPlusThreeEnabled(
              blackjack?.plusThreeMultipliers
            )
          })
        )
        return
      }

      // Acknowledge immediately before any DB work (Discord ~3s timeout).
      if (!(await deferComponentUpdate(interaction))) return

      const guildConfig = await getGuildConfigByGuildId({ guildId })
      const globalSettings = guildConfig?.globalSettings

      const game = await getBlackjackGameByGameId({ gameId, guildId })

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

      /** Deals the next hand into the same session document / message. */
      const dealHand = async (
        betAmount: number,
        pairsBetAmount: number,
        plusThreeBetAmount: number
      ) => {
        if (!guildConfig) {
          return followUpError(
            'Error - Missing Config',
            'Guild casino configuration was not found.'
          )
        }

        try {
          const hand = await startBlackjackHand({
            userId: game.userId,
            guildId: game.guildId,
            gameId: game.gameId,
            channelId: game.channelId,
            messageId: game.messageId,
            betAmount,
            pairsBetAmount,
            plusThreeBetAmount,
            showBalance: game.showBalance,
            skipAnimations: game.skipAnimations,
            sessionStats: game.sessionStats,
            guildConfig,
            guild: interaction.guild,
            sourceChannelId: game.channelId
          })

          await sessionMessage.edit({
            content: null,
            embeds: hand.embeds,
            components: hand.components
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
        if (game.phase !== 'RESULT' && game.phase !== 'BETTING') {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Hand In Progress',
              'Finish the current hand before changing your bet.'
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

        const amount = parseReadableStringToNumber(
          interaction.fields.getTextInputValue(AMOUNT_INPUT_ID)
        )

        const validation = validateBetAmount(
          amount,
          guildConfig.casinoSettings.blackjack.maxBet,
          guildConfig.casinoSettings.blackjack.minBet
        )
        if (!validation.ok) {
          await replyBetValidationError(
            interaction,
            validation.error,
            guildConfig.casinoSettings.blackjack.maxBet,
            guildConfig.casinoSettings.blackjack.minBet,
            guildConfig.globalSettings
          )
          return
        }

        const parseOptionalSideBet = async (
          fieldId: string,
          label: string
        ): Promise<number | null> => {
          const raw = interaction.fields.getTextInputValue(fieldId)
          const trimmed = raw?.trim() ?? ''
          if (trimmed.length === 0) return 0

          const sideAmount = parseReadableStringToNumber(trimmed)
          if (sideAmount < 0 || Number.isNaN(sideAmount)) {
            await replyEphemeralError(interaction, [
              createErrorEmbed(
                `Error - Invalid ${label} Bet`,
                `${label} bet must be 0 or a valid amount.`
              )
            ])
            return null
          }
          if (sideAmount > 0) {
            const sideValidation = validateBetAmount(
              sideAmount,
              guildConfig.casinoSettings.blackjack.maxBet,
              guildConfig.casinoSettings.blackjack.minBet
            )
            if (!sideValidation.ok) {
              await replyBetValidationError(
                interaction,
                sideValidation.error,
                guildConfig.casinoSettings.blackjack.maxBet,
                guildConfig.casinoSettings.blackjack.minBet,
                guildConfig.globalSettings
              )
              return null
            }
          }
          return sideAmount
        }

        const pairsEnabled = isBlackjackPairsEnabled(
          guildConfig.casinoSettings.blackjack.pairsMultipliers
        )
        const plusThreeEnabled = isBlackjackPlusThreeEnabled(
          guildConfig.casinoSettings.blackjack.plusThreeMultipliers
        )

        let pairsAmount = 0
        if (pairsEnabled) {
          const parsed = await parseOptionalSideBet(
            PAIRS_INPUT_ID,
            'Perfect Pairs'
          )
          if (parsed == null) return
          pairsAmount = parsed
        }

        let plusThreeAmount = 0
        if (plusThreeEnabled) {
          const parsed = await parseOptionalSideBet(PLUS_THREE_INPUT_ID, '21+3')
          if (parsed == null) return
          plusThreeAmount = parsed
        }

        await updateBlackjackGame({
          userId: game.userId,
          guildId: game.guildId,
          baseBetAmount: amount,
          basePairsBetAmount: pairsAmount > 0 ? pairsAmount : null,
          activePairsBetAmount: null,
          basePlusThreeBetAmount: plusThreeAmount > 0 ? plusThreeAmount : null,
          activePlusThreeBetAmount: null,
          insuranceBetAmount: null,
          pairsOutcome: null,
          plusThreeOutcome: null,
          phase: 'BETTING',
          activeBetId: null,
          deck: [],
          deckIndex: 0,
          hands: [],
          activeHandIndex: -1,
          dealerCards: []
        })

        await sessionMessage.edit({
          content: null,
          embeds: [
            renderBlackjackBettingEmbed({
              gameId: game.gameId,
              bet: amount,
              pairsBet: pairsAmount > 0 ? pairsAmount : null,
              plusThreeBet: plusThreeAmount > 0 ? plusThreeAmount : null,
              pairsEnabled,
              plusThreeEnabled,
              globalSettings: guildConfig.globalSettings
            })
          ],
          components: renderBlackjackBettingComponents({
            gameId: game.gameId,
            showBalance: game.showBalance,
            hasBet: true
          })
        })
        return
      }

      if (!buttonData) return

      if (buttonData.action === 'CLOSE') {
        if (game.phase !== 'RESULT' && game.phase !== 'BETTING') {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Hand In Progress',
              'Finish the current hand before closing the table.'
            )
          ])
          return
        }

        await deleteBlackjackGame({
          userId: game.userId,
          guildId: game.guildId
        })

        await sessionMessage.edit({
          content: null,
          embeds: [
            formatSessionSummaryEmbed({
              gameLabel: 'Blackjack',
              emoji: '🃏',
              stats: game.sessionStats,
              reason: 'closed',
              gameId: game.gameId,
              globalSettings,
              roundsLabel: 'Hands'
            })
          ],
          components: []
        })
        return
      }

      if (buttonData.action === 'DEAL' || buttonData.action === 'REBET') {
        if (
          buttonData.action === 'DEAL'
            ? game.phase !== 'BETTING'
            : game.phase !== 'RESULT'
        ) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Hand In Progress',
              'Finish the current hand before dealing a new one.'
            )
          ])
          return
        }

        const stake = game.baseBetAmount
        if (stake == null || stake <= 0) {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Bet Required',
              'Set your bet before dealing.'
            )
          ])
          return
        }

        await dealHand(
          stake,
          game.basePairsBetAmount ?? 0,
          game.basePlusThreeBetAmount ?? 0
        )
        return
      }

      if (buttonData.action === 'CHANGE') return

      if (buttonData.action === 'INSURE' || buttonData.action === 'NO_INSURE') {
        if (game.phase !== 'INSURANCE') {
          await replyEphemeralError(interaction, [
            createErrorEmbed(
              'Error - Game not active',
              'Insurance is not available for this hand.'
            )
          ])
          return
        }

        if (!guildConfig) {
          return followUpError(
            'Error - Missing Config',
            'Guild casino configuration was not found.'
          )
        }

        try {
          const next = await resolveBlackjackInsuranceDecision({
            game,
            takeInsurance: buttonData.action === 'INSURE',
            guildConfig,
            guild: interaction.guild,
            sourceChannelId: game.channelId,
            showBalance
          })

          await sessionMessage.edit({
            content: null,
            embeds: next.embeds,
            components: next.components
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
              'Not enough balance to buy insurance.'
            )
          }
          throw error
        }
        return
      }

      const engine = docToEngine(game)

      if (engine.phase !== 'PLAYER') {
        await replyEphemeralError(interaction, [
          createErrorEmbed(
            'Error - Game not active',
            'This Blackjack game is no longer accepting actions.'
          )
        ])
        return
      }

      const betId = game.activeBetId
      if (!betId) {
        await replyEphemeralError(interaction, [
          createErrorEmbed(
            'Error - Game not active',
            'This Blackjack hand is no longer accepting actions.'
          )
        ])
        return
      }

      const activeHand = engine.hands[engine.activeHandIndex]
      const action = buttonData.action

      if (action === 'DOUBLE') {
        const extraBet = activeHand.betAmount

        try {
          await reserveCasinoBet({
            userId: game.userId,
            guildId,
            totalBet: extraBet,
            betId: sessionBetId(betId, `d${engine.activeHandIndex}`),
            game: 'blackjack'
          })
        } catch (error) {
          if (error instanceof Error && error.message === USER_BANNED_ERROR) {
            return interaction.followUp({
              embeds: [
                createErrorEmbed(
                  'Error - Account Restricted',
                  USER_BANNED_MESSAGE
                )
              ],
              flags: MessageFlags.Ephemeral
            })
          }

          return interaction.followUp({
            embeds: [
              createErrorEmbed(
                'Error - Insufficient Funds',
                `You don't have enough funds to double.`
              )
            ],
            flags: MessageFlags.Ephemeral
          })
        }

        activeHand.betAmount += extraBet
      }

      if (action === 'SPLIT') {
        const splitBet = activeHand.betAmount

        try {
          await reserveCasinoBet({
            userId: game.userId,
            guildId,
            totalBet: splitBet,
            betId: sessionBetId(betId, `s${engine.hands.length}`),
            game: 'blackjack'
          })
        } catch (error) {
          if (error instanceof Error && error.message === USER_BANNED_ERROR) {
            return interaction.followUp({
              embeds: [
                createErrorEmbed(
                  'Error - Account Restricted',
                  USER_BANNED_MESSAGE
                )
              ],
              flags: MessageFlags.Ephemeral
            })
          }

          return interaction.followUp({
            embeds: [
              createErrorEmbed(
                'Error - Insufficient Funds',
                `You don't have enough funds to split.`
              )
            ],
            flags: MessageFlags.Ephemeral
          })
        }
      }

      applyAction(engine, action)

      const value = calculateHandValue(activeHand.cards)

      if (value > 21) {
        activeHand.finished = true
      }

      if (action === 'HIT' && value === 21) {
        activeHand.finished = true
      }

      if (action === 'STAND' || action === 'DOUBLE') {
        activeHand.finished = true
      }

      if (activeHand.finished) {
        const nextHandIndex = engine.hands.findIndex(
          (h, i) => i > engine.activeHandIndex && !h.finished
        )

        if (nextHandIndex !== -1) {
          engine.activeHandIndex = nextHandIndex
        } else {
          engine.phase = 'DEALER'
        }
      }

      const liveSideBets = {
        pairsBet: game.activePairsBetAmount,
        pairsOutcome: game.pairsOutcome,
        plusThreeBet: game.activePlusThreeBetAmount,
        plusThreeOutcome: game.plusThreeOutcome,
        insuranceBet: game.insuranceBetAmount
      }

      if (engine.phase === 'DEALER') {
        const allPlayerHandsBusted = engine.hands.every(
          (h) => calculateHandValue(h.cards) > 21
        )

        if (allPlayerHandsBusted) {
          await finishBlackjackDealerAndSettle({
            game,
            engine,
            guildConfig,
            guild: interaction.guild,
            sourceChannelId: game.channelId,
            showBalance,
            message: sessionMessage
          })
          return
        }

        engineToDoc(engine, game)
        await saveBlackjackGame(game)

        await sessionMessage.edit({
          embeds: [
            renderBlackjackEmbed({
              userId: game.userId,
              guildId,
              gameId: game.gameId,
              hands: engine.hands,
              activeHandIndex: -1,
              dealerCards: engine.dealerCards,
              showBalance,
              result: { kind: 'PHASE', gamePhaseId: 'DEALER_DRAWING' },
              sideBets: liveSideBets,
              globalSettings
            })
          ],
          components: []
        })

        while (dealerShouldDraw(engine)) {
          await sleep(700)
          dealerDrawOne(engine)
          engineToDoc(engine, game)
          await saveBlackjackGame(game)

          await sessionMessage.edit({
            embeds: [
              renderBlackjackEmbed({
                userId: game.userId,
                guildId,
                gameId: game.gameId,
                hands: engine.hands,
                activeHandIndex: -1,
                dealerCards: engine.dealerCards,
                showBalance,
                result: { kind: 'PHASE', gamePhaseId: 'DEALER_DRAWING' },
                sideBets: liveSideBets,
                globalSettings
              })
            ],
            components: []
          })
        }

        await finishBlackjackDealerAndSettle({
          game,
          engine,
          guildConfig,
          guild: interaction.guild,
          sourceChannelId: game.channelId,
          showBalance,
          message: sessionMessage
        })

        return
      }

      engineToDoc(engine, game)
      await saveBlackjackGame(game)

      const hand = engine.hands[engine.activeHandIndex]

      await sessionMessage.edit({
        embeds: [
          renderBlackjackEmbed({
            userId: game.userId,
            guildId,
            gameId: game.gameId,
            hands: engine.hands,
            activeHandIndex: engine.activeHandIndex,
            dealerCards: engine.dealerCards,
            showBalance,
            result: { kind: 'PHASE', gamePhaseId: 'PLAYER_TURN' },
            dealerHideSecondCard: true,
            sideBets: liveSideBets,
            globalSettings
          })
        ],
        components: [
          renderBlackjackButtons({
            gameId: game.gameId,
            showBalance,
            canDouble: hand.cards.length === 2,
            canSplit: canSplit(engine)
          })
        ]
      })
    } catch (err) {
      await handleUnexpectedButtonError(interaction, err, {
        handler: 'handleBlackjack'
      })
    }
  })
}
