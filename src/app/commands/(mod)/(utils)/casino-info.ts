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
import {
  casinoGameGuides,
  formatGameGuideBody
} from '@/utils/casino/gameGuides'
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

const gameSection = (
  guideKey: keyof typeof casinoGameGuides,
  settingLines: string[]
) => {
  const guide = casinoGameGuides[guideKey]
  return section(guide.title, [
    formatGameGuideBody(guide),
    '',
    '**This server**',
    ...settingLines
  ])
}

const buildGamesSections = (
  settings: TGuildConfiguration['casinoSettings'],
  showAdmin: boolean,
  globalSettings?: Partial<GlobalSettings> | null
): string[] => [
  gameSection('coinflip', [
    multiplier(settings.coinflip.winMultiplier),
    bet('Max Bet', settings.coinflip.maxBet, globalSettings),
    bet('Min Bet', settings.coinflip.minBet, globalSettings),
    ...(showAdmin ? [rtpLine('coinflip', settings.coinflip)] : [])
  ]),

  gameSection('hilo', [
    `- **House Edge:** ${settings.hilo.houseEdge * 100}%`,
    bet('Max Bet', settings.hilo.maxBet, globalSettings),
    bet('Min Bet', settings.hilo.minBet, globalSettings),
    ...(showAdmin ? [rtpLine('hilo', settings.hilo)] : [])
  ]),

  gameSection('limbo', [
    `- **House Edge:** ${settings.limbo.houseEdge * 100}%`,
    bet('Max Bet', settings.limbo.maxBet, globalSettings),
    bet('Min Bet', settings.limbo.minBet, globalSettings),
    ...(showAdmin ? [rtpLine('limbo', settings.limbo)] : [])
  ]),

  gameSection('dice', [
    multiplier(settings.dice.winMultiplier),
    bet('Max Bet', settings.dice.maxBet, globalSettings),
    bet('Min Bet', settings.dice.minBet, globalSettings),
    ...(showAdmin ? [rtpLine('dice', settings.dice)] : [])
  ]),

  gameSection('goldenJackpot', [
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

  gameSection('lottery', [
    multiplier(settings.lottery.winMultipliers),
    bet('Max Bet', settings.lottery.maxBet, globalSettings),
    bet('Min Bet', settings.lottery.minBet, globalSettings),
    ...(showAdmin ? [rtpLine('lottery', settings.lottery)] : [])
  ]),

  gameSection('plinko', [
    multiplier(
      formatPlinkoBinMultipliersForDisplay(settings.plinko.binMultipliers)
    ),
    bet('Max Bet', settings.plinko.maxBet, globalSettings),
    bet('Min Bet', settings.plinko.minBet, globalSettings),
    ...(showAdmin ? [rtpLine('plinko', settings.plinko)] : [])
  ]),

  gameSection('roulette', [
    multiplier(settings.roulette.winMultipliers),
    bet('Max Bet', settings.roulette.maxBet, globalSettings),
    bet('Min Bet', settings.roulette.minBet, globalSettings),
    ...(showAdmin ? [rtpLine('roulette', settings.roulette)] : [])
  ]),

  gameSection('baccarat', [
    multiplier(settings.baccarat.winMultipliers),
    bet('Max Bet', settings.baccarat.maxBet, globalSettings),
    bet('Min Bet', settings.baccarat.minBet, globalSettings),
    ...(showAdmin ? [rtpLine('baccarat', settings.baccarat)] : [])
  ]),

  gameSection('slots', [
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

  gameSection('blackjack', [
    multiplier(settings.blackjack.winMultipliers),
    bet('Max Bet', settings.blackjack.maxBet, globalSettings),
    bet('Min Bet', settings.blackjack.minBet, globalSettings),
    ...(showAdmin ? [rtpLine('blackjack', settings.blackjack)] : [])
  ]),

  gameSection('mines', [
    `- **House Edge:** ${settings.mines.houseEdge * 100}%`,
    `- **Mines Range:** ${settings.mines.minMines}–${settings.mines.maxMines}`,
    bet('Max Bet', settings.mines.maxBet, globalSettings),
    bet('Min Bet', settings.mines.minBet, globalSettings),
    ...(showAdmin ? [rtpLine('mines', settings.mines)] : [])
  ]),

  gameSection('rps', [
    `- **House Edge:** ${settings.rps.houseEdge * 100}%`,
    bet('Max Bet', settings.rps.maxBet, globalSettings),
    bet('Min Bet', settings.rps.minBet, globalSettings)
  ]),

  gameSection('prediction', [
    bet('Max Bet', settings.prediction.maxBet, globalSettings),
    bet('Min Bet', settings.prediction.minBet, globalSettings)
  ]),

  gameSection('raffle', [
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
            'Error - Invalid Selection',
            'Select at least one option: `games` or `config`.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    await interaction.reply({
      content:
        'ℹ️ **Casino Information**\nEach game section includes a short how-to, idle rules, and this server’s limits.' +
        (showAdmin ? ' Admin RTP details are included.' : ''),
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

      for (const gamesSection of buildGamesSections(
        config.casinoSettings,
        showAdmin,
        config.globalSettings
      )) {
        await gamesThread.send(`${gamesSection}\n\u200B`)
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

      for (const configSection of buildConfigSections(
        config,
        vipRooms.map((r) => r.channelId)
      )) {
        await configThread.send(`${configSection}\n\u200B`)
      }
    }
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
