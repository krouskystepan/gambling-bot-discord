import { calculateRTP } from 'gambling-bot-shared/casino'
import { formatPlinkoBinMultipliersForDisplay } from 'gambling-bot-shared/casino'
import { formatMoney, formatNumberWithSpaces } from 'gambling-bot-shared/common'
import {
  type GlobalSettings,
  TGuildConfiguration
} from 'gambling-bot-shared/guild'

import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import { getAllActiveVipsByGuildId, getGuildConfigByGuildId } from '@/services'
import { createErrorEmbed } from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'casino-info',
  description: 'Get information about the casino.',
  options: [
    {
      name: 'games',
      description: 'Show information about casino games',
      type: ApplicationCommandOptionType.Boolean
    },
    {
      name: 'config',
      description: 'Show server casino configuration',
      type: ApplicationCommandOptionType.Boolean
    },
    {
      name: 'admin',
      description: 'Show administrator-only information',
      type: ApplicationCommandOptionType.Boolean
    }
  ],
  dm_permission: false
}

export const metadata: CommandMetadata = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator']
}

const section = (title: string, lines: string[]) =>
  `## ${title}\n${lines.join('\n')}`

const bet = (
  label: string,
  value: number,
  globalSettings?: Partial<GlobalSettings> | null
) =>
  `- **${label}:** ${
    value === 0 ? 'No Limit' : formatMoney(value, globalSettings)
  }`

const price = (
  label: string,
  value: number,
  globalSettings?: Partial<GlobalSettings> | null
) =>
  `- **${label}:** ${
    value === 0 ? 'Not Set' : formatMoney(value, globalSettings)
  }`

const multiplier = (value: number | Record<string, number>) => {
  if (typeof value === 'number') {
    return `- **Multiplier:** ${formatNumberWithSpaces(value)}x`
  }

  return (
    '- **Multipliers:**\n' +
    Object.entries(value)
      .map(
        ([k, v]) =>
          `  - ${k.charAt(0).toUpperCase() + k.slice(1)}: ${formatNumberWithSpaces(
            v
          )}x`
      )
      .join('\n')
  )
}

const rtpLine = <G extends Parameters<typeof calculateRTP>[0]>(
  game: G,
  gameSettings: Parameters<typeof calculateRTP>[1]
): string => {
  const rtp = calculateRTP(game, gameSettings)

  if (typeof rtp === 'number') {
    return `- **RTP:** ${rtp.toFixed(2)}%`
  }

  return (
    '- **RTPs:**\n' +
    Object.entries(rtp)
      .map(
        ([k, v]) =>
          `  - ${k.charAt(0).toUpperCase() + k.slice(1)}: ${v.toFixed(2)}%`
      )
      .join('\n')
  )
}

const buildGamesSections = (
  settings: TGuildConfiguration['casinoSettings'],
  showAdmin: boolean,
  globalSettings?: Partial<GlobalSettings> | null
): string[] => [
  section('🪙 Coin Flip', [
    multiplier(settings.coinflip.winMultiplier),
    bet('Max Bet', settings.coinflip.maxBet, globalSettings),
    bet('Min Bet', settings.coinflip.minBet, globalSettings),
    ...(showAdmin ? [rtpLine('coinflip', settings.coinflip)] : [])
  ]),

  section('🃏 Hi-Lo', [
    `- **House Edge:** ${settings.hilo.houseEdge * 100}%`,
    bet('Max Bet', settings.hilo.maxBet, globalSettings),
    bet('Min Bet', settings.hilo.minBet, globalSettings),
    ...(showAdmin ? [rtpLine('hilo', settings.hilo)] : [])
  ]),

  section('🚀 Limbo', [
    `- **House Edge:** ${settings.limbo.houseEdge * 100}%`,
    bet('Max Bet', settings.limbo.maxBet, globalSettings),
    bet('Min Bet', settings.limbo.minBet, globalSettings),
    ...(showAdmin ? [rtpLine('limbo', settings.limbo)] : [])
  ]),

  section('🎲 Dice', [
    multiplier(settings.dice.winMultiplier),
    bet('Max Bet', settings.dice.maxBet, globalSettings),
    bet('Min Bet', settings.dice.minBet, globalSettings),
    ...(showAdmin ? [rtpLine('dice', settings.dice)] : [])
  ]),

  section('🤑 Golden Jackpot', [
    multiplier(settings.goldenJackpot.winMultiplier),
    bet('Max Bet', settings.goldenJackpot.maxBet, globalSettings),
    bet('Min Bet', settings.goldenJackpot.minBet, globalSettings),
    ...(showAdmin
      ? [
          rtpLine('goldenJackpot', settings.goldenJackpot),
          `- **One in Chance:** 1 in ${formatNumberWithSpaces(
            settings.goldenJackpot.oneInChance
          )}`
        ]
      : [])
  ]),

  section('🎟️ Lottery', [
    multiplier(settings.lottery.winMultipliers),
    bet('Max Bet', settings.lottery.maxBet, globalSettings),
    bet('Min Bet', settings.lottery.minBet, globalSettings),
    ...(showAdmin ? [rtpLine('lottery', settings.lottery)] : [])
  ]),

  section('🎯 Plinko', [
    multiplier(
      formatPlinkoBinMultipliersForDisplay(settings.plinko.binMultipliers)
    ),
    bet('Max Bet', settings.plinko.maxBet, globalSettings),
    bet('Min Bet', settings.plinko.minBet, globalSettings),
    ...(showAdmin ? [rtpLine('plinko', settings.plinko)] : [])
  ]),

  section('🌀 Roulette', [
    multiplier(settings.roulette.winMultipliers),
    bet('Max Bet', settings.roulette.maxBet, globalSettings),
    bet('Min Bet', settings.roulette.minBet, globalSettings),
    ...(showAdmin ? [rtpLine('roulette', settings.roulette)] : [])
  ]),

  section('🃏 Baccarat', [
    multiplier(settings.baccarat.winMultipliers),
    bet('Max Bet', settings.baccarat.maxBet, globalSettings),
    bet('Min Bet', settings.baccarat.minBet, globalSettings),
    ...(showAdmin ? [rtpLine('baccarat', settings.baccarat)] : [])
  ]),

  section('🎰 Slots', [
    multiplier(settings.slots.winMultipliers),
    bet('Max Bet', settings.slots.maxBet, globalSettings),
    bet('Min Bet', settings.slots.minBet, globalSettings),
    ...(showAdmin
      ? [
          rtpLine('slots', settings.slots),
          `- **Symbol Weights:**\n${Object.entries(settings.slots.symbolWeights)
            .map(([s, w]) => `  - ${s}: ${w}`)
            .join('\n')}`
        ]
      : [])
  ]),

  section('🃏 Blackjack', [
    bet('Max Bet', settings.blackjack.maxBet, globalSettings),
    bet('Min Bet', settings.blackjack.minBet, globalSettings)
  ]),

  section('🪨📄✂️ RPS', [
    `- **House Edge:** ${settings.rps.houseEdge * 100}%`,
    bet('Max Bet', settings.rps.maxBet, globalSettings),
    bet('Min Bet', settings.rps.minBet, globalSettings)
  ]),

  section('👀 Prediction', [
    bet('Max Bet', settings.prediction.maxBet, globalSettings),
    bet('Min Bet', settings.prediction.minBet, globalSettings)
  ]),

  section('🎫 Raffle', [
    `- **House Edge:** ${settings.raffle.houseEdge * 100}%`,
    ...(showAdmin ? [rtpLine('raffle', settings.raffle)] : [])
  ])
]

const buildConfigSections = (
  config: TGuildConfiguration,
  vipChannelIds: string[]
): string[] => [
  section('⚙️ Roles', [
    `- **VIP Owner Role:** ${
      config.vipSettings.roleOwnerId
        ? `<@&${config.vipSettings.roleOwnerId}>`
        : 'None'
    }`,
    `- **VIP Member Role:** ${
      config.vipSettings.roleMemberId
        ? `<@&${config.vipSettings.roleMemberId}>`
        : 'None'
    }`,
    `- **Manager Role:** ${
      config.managerRoleId ? `<@&${config.managerRoleId}>` : 'None'
    }`
  ]),

  section('💰 VIP', [
    ` - **VIP Max Members:** ${config.vipSettings.maxMembers}`,
    price(
      'VIP Price / Create',
      config.vipSettings.pricePerCreate,
      config.globalSettings
    ),
    price(
      'VIP Price / Day',
      config.vipSettings.pricePerDay,
      config.globalSettings
    ),
    price(
      'VIP Price / Member',
      config.vipSettings.pricePerAdditionalMember,
      config.globalSettings
    )
  ]),

  section('🏠 VIP Rooms', [
    ...(vipChannelIds.length
      ? vipChannelIds.map((id) => `- <#${id}>`)
      : ['- None'])
  ])
]
export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const config = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })
    if (!config?.casinoSettings) return

    const vipRooms = await getAllActiveVipsByGuildId({
      guildId: interaction.guildId!
    })

    const showGames = interaction.options.getBoolean('games') ?? false
    const showConfig = interaction.options.getBoolean('config') ?? false
    const showAdmin = interaction.options.getBoolean('admin') ?? false

    if (!showGames && !showConfig) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Invalid Selection',
            'Select at least one option: `games` or `config`.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    await interaction.reply({
      content: 'ℹ️ **Casino Information**\nSee threads below.',
      flags: MessageFlags.Ephemeral
    })

    if (showGames) {
      const gamesMessage = await interaction.followUp({
        content: '🎮 Casino Games Information',
        fetchReply: true
      })

      const gamesThread = await gamesMessage.startThread({
        name: '🎮 Casino Games',
        autoArchiveDuration: 1440
      })

      for (const section of buildGamesSections(
        config.casinoSettings,
        showAdmin,
        config.globalSettings
      )) {
        await gamesThread.send(`${section}\n\u200B`)
      }
    }

    if (showConfig) {
      const configMessage = await interaction.followUp({
        content: '⚙️ Casino Configuration',
        fetchReply: true
      })

      const configThread = await configMessage.startThread({
        name: '⚙️ Casino Configuration',
        autoArchiveDuration: 1440
      })

      for (const section of buildConfigSections(
        config,
        vipRooms.map((r) => r.channelId)
      )) {
        await configThread.send(`${section}\n\u200B`)
      }
    }
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
