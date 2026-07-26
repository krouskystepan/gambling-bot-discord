import { shouldAnnounceByMultiplier } from 'gambling-bot-shared/casino'
import { formatMoney, generateId } from 'gambling-bot-shared/common'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'

import type { Guild, Message } from 'discord.js'

import {
  reserveCasinoBet,
  settleCasinoWinnings,
  updateSlotsGame
} from '@/services'
import { spinSlot } from '@/utils/casino/rng'
import { sleep } from '@/utils/common/utils'
import { createBetEmbed } from '@/utils/discord/createEmbed'
import { slotEmojis, spinSlotEmotes } from '@/utils/discord/customEmotes'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

import {
  renderSlotsComponents,
  renderSlotsMachineEmbed,
  slotsBatchTotal
} from './sessionRender'

/** Animated reel frame before each result. */
const SPIN_FRAME_MS = 1000
/** Hold resolved reels so each spin result is readable mid-batch. */
const RESULT_HOLD_MS = 1300

const mapReels = (spinResult: string) =>
  spinResult.replace(/🍒|🫐|🍉|🔔|7️⃣/g, (match) => slotEmojis[match])

const netEmoji = (net: number) => (net > 0 ? '🟢' : net < 0 ? '🔴' : '🟡')

const formatBatchFrame = ({
  totalBet,
  reelsLine,
  liveNet,
  globalSettings
}: {
  totalBet: number
  reelsLine: string
  liveNet: number
  globalSettings: TGuildConfiguration['globalSettings']
}) =>
  [
    `💵 Total Bet: **${formatMoney(totalBet, globalSettings)}**`,
    '',
    `🕹 ${reelsLine}`,
    '',
    `💰 Running: ${netEmoji(liveNet)} **${formatMoney(liveNet, globalSettings)}**`
  ].join('\n')

export const playSlotsRound = async ({
  message,
  userId,
  guildId,
  gameId,
  unitBet,
  spinsCount,
  showBalance,
  skipAnimations,
  guild,
  guildConfig,
  sourceChannelId
}: {
  message: Message
  userId: string
  guildId: string
  gameId: string
  unitBet: number
  spinsCount: number
  showBalance: boolean
  skipAnimations: boolean
  guild: Guild | null
  guildConfig: TGuildConfiguration
  sourceChannelId: string
}) => {
  const totalBet = slotsBatchTotal(unitBet, spinsCount)
  const betId = generateId()

  await updateSlotsGame({
    userId,
    guildId,
    activeBetId: betId,
    lockedAmount: totalBet
  })

  try {
    await reserveCasinoBet({
      userId,
      guildId,
      totalBet,
      betId,
      game: 'slots'
    })
  } catch {
    await updateSlotsGame({
      userId,
      guildId,
      activeBetId: null,
      lockedAmount: null
    })
    throw new Error('INSUFFICIENT_FUNDS')
  }

  let totalWinnings = 0
  let liveNet = 0
  let winsCount = 0
  let lastReels = ''
  const announcementSpins: string[] = []
  const resultLines: string[] = []

  for (let i = 0; i < spinsCount; i++) {
    if (!skipAnimations) {
      await message.edit({
        embeds: [
          createBetEmbed(
            '🎰 Spinning...',
            'Blue',
            formatBatchFrame({
              totalBet,
              reelsLine: `${spinSlotEmotes[1]}${spinSlotEmotes[2]}${spinSlotEmotes[3]}`,
              liveNet,
              globalSettings: guildConfig.globalSettings
            }),
            betId
          )
        ],
        components: []
      })
      await sleep(SPIN_FRAME_MS)
    }

    const spinResult = spinSlot({
      symbolWeights: guildConfig.casinoSettings.slots.symbolWeights
    })
    const resultString = mapReels(spinResult)
    lastReels = resultString

    const spinMultiplier =
      guildConfig.casinoSettings.slots.winMultipliers[spinResult] || 0
    const winnings = spinMultiplier * unitBet
    const isWin = winnings > 0

    if (isWin) winsCount++

    if (
      shouldAnnounceByMultiplier(
        spinMultiplier,
        guildConfig.casinoSettings.winAnnouncements.slotsMinMultiplier
      )
    ) {
      announcementSpins.push(
        formatBigWinLine({
          label: `Spin **${i + 1}**`,
          middle: [`**${resultString}**`],
          multiplier: String(spinMultiplier),
          payout: formatMoney(winnings, guildConfig.globalSettings),
          bet: formatMoney(unitBet, guildConfig.globalSettings)
        })
      )
    }

    totalWinnings += winnings
    liveNet += winnings - unitBet

    resultLines.push(
      `**${resultString}** | ${isWin ? '🎉' : '❌'} | ${
        isWin
          ? `**+${formatMoney(winnings, guildConfig.globalSettings)}**`
          : `**-${formatMoney(unitBet, guildConfig.globalSettings)}**`
      }`
    )

    if (!skipAnimations) {
      const isLast = i === spinsCount - 1
      await message.edit({
        embeds: [
          createBetEmbed(
            '🎰 Spinning...',
            'Blue',
            formatBatchFrame({
              totalBet,
              reelsLine: resultString,
              liveNet,
              globalSettings: guildConfig.globalSettings
            }),
            betId
          )
        ],
        components: []
      })
      if (!isLast) {
        await sleep(RESULT_HOLD_MS)
      }
    }
  }

  if (skipAnimations) {
    await message.edit({
      embeds: [
        createBetEmbed(
          '🎰 Results',
          'Blue',
          [
            `💵 Total Bet: **${formatMoney(totalBet, guildConfig.globalSettings)}**`,
            '',
            `🕹 **Spin Results:**`,
            resultLines.join('\n'),
            '',
            `💰 Total: ${netEmoji(liveNet)} **${formatMoney(liveNet, guildConfig.globalSettings)}**`
          ].join('\n'),
          betId
        )
      ],
      components: []
    })
    await sleep(RESULT_HOLD_MS * 1.5)
  }

  const finalBalance = await settleCasinoWinnings({
    userId,
    guildId,
    totalBet,
    winnings: totalWinnings,
    betId,
    game: 'slots'
  })

  await updateSlotsGame({
    userId,
    guildId,
    phase: 'result',
    lastReels,
    lastNetResult: liveNet,
    lastSpinsCount: spinsCount,
    lastTotalBet: totalBet,
    lastWinsCount: winsCount,
    activeBetId: null,
    lockedAmount: null
  })

  await message.edit({
    embeds: [
      renderSlotsMachineEmbed({
        gameId,
        phase: 'result',
        unitBet,
        spinsCount,
        lastNetResult: liveNet,
        lastSpinsCount: spinsCount,
        lastTotalBet: totalBet,
        lastWinsCount: winsCount,
        showBalance,
        finalBalance,
        globalSettings: guildConfig.globalSettings
      })
    ],
    components: renderSlotsComponents({
      gameId,
      phase: 'result',
      hasUnitBet: true,
      spinsCount
    })
  })

  if (announcementSpins.length > 0 && guild) {
    tryAnnounceBigWin({
      guild,
      guildConfig,
      game: 'slots',
      lines: announcementSpins,
      betId,
      sourceChannelId
    })
  }

  return {
    betId,
    lastReels,
    net: liveNet,
    winsCount,
    finalBalance
  }
}
