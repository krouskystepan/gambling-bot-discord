import {
  type HiloGuess,
  getHiloTimeoutRefund,
  getHiloWinMultiplier,
  resolveHiloRound,
  shouldAnnounceByMultiplier
} from 'gambling-bot-shared/casino'
import {
  formatMoney,
  generateId,
  parseReadableStringToNumber
} from 'gambling-bot-shared/common'

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  betOption,
  checkCasinoChannels,
  checkUserRegistration,
  refundLockedBet,
  reserveCasinoBet,
  settleCasinoWinnings,
  showBalanceOption
} from '@/services'
import {
  renderHiloPromptEmbed,
  renderHiloResultEmbed,
  renderHiloRevealEmbed,
  renderHiloTimeoutEmbed
} from '@/utils/casino/hilo/render'
import {
  createShuffledHiloDeck,
  drawHiloCard,
  formatHiloCard
} from '@/utils/casino/rng'
import { checkValidBet, sleep } from '@/utils/common/utils'
import { createErrorEmbed } from '@/utils/discord/createEmbed'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

const HILO_TIMEOUT_MS = 45_000

export const command: CommandData = {
  name: 'hilo',
  description: 'See a card, then guess if the next one is higher or lower!',
  options: [betOption, showBalanceOption],
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  let reserved = false
  let settled = false
  let userId: string | null = null
  let guildId: string | null = null
  let totalBet = 0
  let betId: string | null = null

  const refundIfNeeded = async () => {
    if (!reserved || settled || !userId || !guildId || !betId) return
    await refundLockedBet({
      userId,
      guildId,
      amount: totalBet,
      betId,
      game: 'hilo'
    })
    reserved = false
  }

  try {
    const user = await checkUserRegistration({ interaction })
    if (!user) return
    userId = user.userId
    guildId = user.guildId

    const guildConfig = await checkCasinoChannels(interaction)
    if (!guildConfig) return

    const betAmount = parseReadableStringToNumber(
      interaction.options.getString('bet', true)
    )
    const showBalance = interaction.options.getBoolean('show-balance')

    const isBetValid = checkValidBet(
      interaction,
      betAmount,
      guildConfig.casinoSettings.hilo.maxBet,
      guildConfig.casinoSettings.hilo.minBet,
      guildConfig.globalSettings
    )
    if (!isBetValid) return

    totalBet = betAmount
    betId = generateId()

    await interaction.deferReply()

    try {
      await reserveCasinoBet({
        userId,
        guildId,
        totalBet,
        betId,
        game: 'hilo'
      })
      reserved = true
    } catch {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            'Bet Failed',
            'Not enough balance to place this bet.'
          )
        ]
      })
    }

    const deck = createShuffledHiloDeck()
    const first = drawHiloCard(deck)
    const firstCard = formatHiloCard(first)
    const houseEdge = guildConfig.casinoSettings.hilo.houseEdge
    const higherMult = getHiloWinMultiplier(first.rank, 'higher', houseEdge)
    const lowerMult = getHiloWinMultiplier(first.rank, 'lower', houseEdge)
    const globalSettings = guildConfig.globalSettings

    const reply = await interaction.editReply({
      embeds: [
        renderHiloPromptEmbed({
          firstCard,
          higherMult,
          lowerMult,
          bet: totalBet,
          timeoutFee: guildConfig.casinoSettings.hilo.timeoutFee,
          betId,
          globalSettings
        })
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('higher')
            .setLabel('Higher')
            .setEmoji('⬆')
            .setStyle(ButtonStyle.Success)
            .setDisabled(higherMult == null),
          new ButtonBuilder()
            .setCustomId('lower')
            .setLabel('Lower')
            .setEmoji('⬇')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(lowerMult == null)
        )
      ]
    })

    const button = await reply
      .awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        time: HILO_TIMEOUT_MS
      })
      .catch(async () => {
        const timeoutFee = guildConfig.casinoSettings.hilo.timeoutFee
        const refunded = getHiloTimeoutRefund(totalBet, timeoutFee)
        const feeKept = totalBet - refunded

        await settleCasinoWinnings({
          userId: userId!,
          guildId: guildId!,
          totalBet,
          winnings: refunded,
          betId: betId!,
          game: 'hilo'
        })
        settled = true
        reserved = false

        await reply.edit({
          embeds: [
            renderHiloTimeoutEmbed({
              firstCard,
              bet: totalBet,
              timeoutFee,
              feeKept,
              refunded,
              betId: betId!,
              globalSettings
            })
          ],
          components: []
        })
        return null
      })

    if (!button) return

    await button.deferUpdate()

    const guess = button.customId as HiloGuess
    const winMultiplier = getHiloWinMultiplier(first.rank, guess, houseEdge)
    if (winMultiplier == null) {
      await refundIfNeeded()
      await reply.edit({
        embeds: [
          createErrorEmbed(
            'Invalid Guess',
            'That side cannot win on this card.'
          )
        ],
        components: []
      })
      return
    }

    await reply.edit({
      embeds: [
        renderHiloRevealEmbed({
          firstCard,
          guess,
          winMultiplier,
          bet: totalBet,
          betId,
          globalSettings
        })
      ],
      components: []
    })

    await sleep(700)

    const second = drawHiloCard(deck)
    const secondCard = formatHiloCard(second)
    const outcome = resolveHiloRound(first.rank, second.rank, guess)

    const totalWinnings =
      outcome === 'win'
        ? totalBet * winMultiplier
        : outcome === 'push'
          ? totalBet
          : 0

    const finalBalance = await settleCasinoWinnings({
      userId,
      guildId,
      totalBet,
      winnings: totalWinnings,
      betId,
      game: 'hilo'
    })
    settled = true
    reserved = false

    const liveResult = totalWinnings - totalBet

    await reply.edit({
      embeds: [
        renderHiloResultEmbed({
          outcome,
          firstCard,
          secondCard,
          guess,
          winMultiplier,
          bet: totalBet,
          liveResult,
          showBalance,
          finalBalance,
          betId,
          globalSettings
        })
      ],
      components: []
    })

    if (
      outcome === 'win' &&
      shouldAnnounceByMultiplier(
        winMultiplier,
        guildConfig.casinoSettings.winAnnouncements.hiloMinMultiplier
      )
    ) {
      tryAnnounceBigWin({
        guild: interaction.guild,
        guildConfig,
        game: 'hilo',
        lines: [
          formatBigWinLine({
            label: 'Hi-Lo',
            middle: [`**${firstCard}** → **${secondCard}** (${guess})`],
            multiplier: winMultiplier.toFixed(2),
            payout: formatMoney(totalWinnings, globalSettings),
            bet: formatMoney(totalBet, globalSettings)
          })
        ],
        betId,
        sourceChannelId: interaction.channelId
      })
    }
  } catch (error) {
    await refundIfNeeded()
    await handleUnexpectedInteractionError(interaction, error)
  }
}
