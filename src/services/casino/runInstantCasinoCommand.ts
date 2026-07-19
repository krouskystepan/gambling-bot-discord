import type { CasinoGameId } from 'gambling-bot-shared/casino'
import { formatMoney, generateId } from 'gambling-bot-shared/common'
import { TGuildConfiguration } from 'gambling-bot-shared/guild'

import { EmbedBuilder, MessageFlags } from 'discord.js'

import { ChatInputCommand } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import { getUser } from '@/services/db/user.db'
import { checkCasinoChannels } from '@/services/guild/checkChannel.service'
import { checkUserRegistration } from '@/services/user/checkUserRegistration.service'
import { isUserOnCooldown } from '@/utils/common/userCooldown'
import { checkValidBet } from '@/utils/common/utils'
import { createErrorEmbed } from '@/utils/discord/createEmbed'
import type { BigWinGame } from '@/utils/discord/formatBigWinMessage'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

import { reserveCasinoBet, settleCasinoWinnings } from './casinoBet.service'

type Interaction = Parameters<ChatInputCommand>[0]['interaction']

export type InstantCasinoPrepareContext = {
  interaction: Interaction
  guildConfig: TGuildConfiguration
  userId: string
  guildId: string
  showBalance: boolean | null
  skipAnimations: boolean | null
}

export type InstantCasinoPrepareSuccess<TInput> = {
  ok: true
  totalBet: number
  validateBetAmount: number
  minBet: number
  maxBet: number
  input: TInput
}

export type InstantCasinoPrepareResult<TInput> =
  | InstantCasinoPrepareSuccess<TInput>
  | { ok: false }

export type InstantCasinoExecuteContext<TInput> = {
  interaction: Interaction
  guildConfig: TGuildConfiguration
  userId: string
  guildId: string
  betId: string
  totalBet: number
  showBalance: boolean | null
  skipAnimations: boolean | null
  input: TInput
}

export type InstantCasinoAnnounce = {
  game: BigWinGame
  lines: string[]
  sourceChannelId?: string
}

export type InstantCasinoExecuteResult = {
  totalWinnings: number
  buildFinalEmbed: (finalBalance: number) => EmbedBuilder
  announce?: InstantCasinoAnnounce | false
}

export const runInstantCasinoCommand = async <TInput>({
  interaction,
  game,
  prepareInput,
  executeGame
}: {
  interaction: Interaction
  game: CasinoGameId
  prepareInput: (
    ctx: InstantCasinoPrepareContext
  ) =>
    | InstantCasinoPrepareResult<TInput>
    | Promise<InstantCasinoPrepareResult<TInput>>
  executeGame: (
    ctx: InstantCasinoExecuteContext<TInput>
  ) => InstantCasinoExecuteResult | Promise<InstantCasinoExecuteResult>
}): Promise<void> => {
  let betSettled = false
  let userId: string | null = null
  let guildId: string | null = null
  let totalBet = 0
  let totalWinnings = 0
  let betId: string | null = null

  try {
    const user = await checkUserRegistration({ interaction })
    if (!user) return
    userId = user.userId
    guildId = user.guildId

    if (isUserOnCooldown(user.userId)) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            'Slow Down',
            'Wait a moment before starting another game.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
      return
    }

    const guildConfig = await checkCasinoChannels(interaction)
    if (!guildConfig) return

    const showBalance = interaction.options.getBoolean('show-balance')
    const skipAnimations = interaction.options.getBoolean('skip-animations')

    const prepared = await prepareInput({
      interaction,
      guildConfig,
      userId,
      guildId,
      showBalance,
      skipAnimations
    })
    if (!prepared.ok) return

    const isBetValid = checkValidBet(
      interaction,
      prepared.validateBetAmount,
      prepared.maxBet,
      prepared.minBet,
      guildConfig.globalSettings
    )
    if (!isBetValid) return

    totalBet = prepared.totalBet
    betId = generateId()

    try {
      await reserveCasinoBet({
        userId,
        guildId,
        totalBet,
        betId,
        game
      })
    } catch (err) {
      if (err instanceof Error && err.message === 'INSUFFICIENT_FUNDS') {
        const freshUser = await getUser({ userId, guildId })
        await interaction.reply({
          embeds: [
            createErrorEmbed(
              'Insufficient Funds',
              `You don't have enough money to place this bet.\nYour current balance is **${formatMoney(freshUser?.balance ?? 0, guildConfig.globalSettings)}**.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
        return
      }
      throw err
    }

    await interaction.deferReply()

    const executed = await executeGame({
      interaction,
      guildConfig,
      userId,
      guildId,
      betId,
      totalBet,
      showBalance,
      skipAnimations,
      input: prepared.input
    })

    totalWinnings = executed.totalWinnings

    const finalBalance = await settleCasinoWinnings({
      userId,
      guildId,
      totalBet,
      winnings: totalWinnings,
      betId,
      game
    })
    betSettled = true

    if (executed.announce) {
      tryAnnounceBigWin({
        guild: interaction.guild,
        guildConfig,
        game: executed.announce.game,
        lines: executed.announce.lines,
        betId,
        sourceChannelId: executed.announce.sourceChannelId
      })
    }

    await interaction.editReply({
      embeds: [executed.buildFinalEmbed(finalBalance)]
    })
  } catch (error) {
    if (!betSettled && userId && guildId && betId) {
      try {
        await settleCasinoWinnings({
          userId,
          guildId,
          totalBet,
          winnings: totalWinnings,
          betId,
          game
        })
      } catch {
        // best-effort refund path
      }
    }

    await handleUnexpectedInteractionError(interaction, error)
  }
}
