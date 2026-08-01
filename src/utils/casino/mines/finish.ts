import {
  bumpSessionStats,
  shouldAnnounceByMultiplier
} from 'gambling-bot-shared/casino'
import { formatMoney } from 'gambling-bot-shared/common'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'
import type { TMinesGame } from 'gambling-bot-shared/mines'
import {
  currentMinesMultiplier,
  docToMinesEngine,
  resolveFinishedMines
} from 'gambling-bot-shared/mines'

import { getUser, settleCasinoWinnings, updateMinesGame } from '@/services'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

import {
  formatMinesBoard,
  renderMinesEmbed,
  renderMinesResultComponents
} from './render'

type EditableMessage = { edit: (...args: never[]) => Promise<unknown> }
type AnnounceGuild = Parameters<typeof tryAnnounceBigWin>[0]['guild']

/**
 * Settles the finished board and parks the session in `RESULT` so the player
 * can rebet, change the setup, or close it.
 */
export const finishMinesAndSettle = async ({
  game,
  guildConfig,
  guild,
  sourceChannelId,
  showBalance,
  message,
  finalMessageContent
}: {
  game: TMinesGame
  guildConfig?: TGuildConfiguration | null
  guild: AnnounceGuild
  sourceChannelId: string
  showBalance: boolean
  message?: EditableMessage | null
  finalMessageContent?: string
}) => {
  const engine = docToMinesEngine(game)
  const resolved = resolveFinishedMines(engine)
  const globalSettings = guildConfig?.globalSettings

  const betId = game.activeBetId
  const sessionStats = betId
    ? bumpSessionStats(game.sessionStats, {
        totalBet: game.betAmount,
        totalPayout: resolved.payout
      })
    : game.sessionStats

  if (betId) {
    await settleCasinoWinnings({
      userId: game.userId,
      guildId: game.guildId,
      totalBet: game.betAmount,
      winnings: resolved.payout,
      betId,
      game: 'mines',
      rounds: 1
    })
  }

  if (
    guildConfig &&
    betId &&
    resolved.resultKind === 'CASH_OUT' &&
    shouldAnnounceByMultiplier(
      resolved.multiplier,
      guildConfig.casinoSettings.winAnnouncements.minesMinMultiplier
    )
  ) {
    tryAnnounceBigWin({
      guild,
      guildConfig,
      game: 'mines',
      lines: [
        formatBigWinLine({
          label: '💣 Mines',
          multiplier: resolved.multiplier.toFixed(2),
          payout: formatMoney(resolved.payout, globalSettings),
          bet: formatMoney(game.betAmount, globalSettings)
        })
      ],
      betId: game.gameId,
      sourceChannelId
    })
  }

  await updateMinesGame({
    userId: game.userId,
    guildId: game.guildId,
    status: 'RESULT',
    activeBetId: null,
    revealedIndices: engine.revealedIndices,
    sessionStats
  })

  let userBalance: number | undefined
  if (showBalance) {
    const user = await getUser({
      userId: game.userId,
      guildId: game.guildId
    })
    if (user) userBalance = user.balance
  }

  if (message) {
    await message.edit({
      content: finalMessageContent,
      embeds: [
        renderMinesEmbed({
          gameId: game.gameId,
          betAmount: game.betAmount,
          mineCount: game.mineCount,
          revealedCount: engine.revealedIndices.length,
          multiplier:
            resolved.resultKind === 'BUST'
              ? 0
              : resolved.multiplier || currentMinesMultiplier(engine),
          result:
            resolved.resultKind === 'BUST'
              ? { kind: 'BUST' }
              : resolved.resultKind === 'CASH_OUT'
                ? {
                    kind: 'CASH_OUT',
                    multiplier: resolved.multiplier,
                    payout: resolved.payout
                  }
                : { kind: 'FORFEIT' },
          board: formatMinesBoard(engine),
          showBalance,
          userBalance,
          globalSettings
        })
      ],
      components: renderMinesResultComponents({
        gameId: game.gameId,
        showBalance
      })
    } as never)
  }

  return { ...resolved, sessionStats }
}
