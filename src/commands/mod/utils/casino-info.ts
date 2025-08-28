import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'
import { ApplicationCommandOptionType } from 'discord.js'
import {
  formatNumberToReadableString,
  formatNumberWithSpaces,
} from '../../../utils/utils'
import GuildConfiguration from '../../../models/GuildConfiguration'
import VipRoom from '../../../models/VipRoom'
import { calculateRTP } from '../../../utils/rtpCalcHelper'

export const data: CommandData = {
  name: 'casino-info',
  description: 'Get information about the casino.',
  options: [
    {
      name: 'admin',
      description:
        'Get information about the casino administrators (contains sensitive information).',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
  ],
  dm_permission: false,
}

export const options: CommandOptions = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  deleted: false,
}

const formatRTP = (rtp: number) => {
  return `- **RTP:** ${(rtp * 100).toFixed(2)}%`
}

const formatBet = (label: string, value: number) => {
  return `- **${label}:** ${
    value === 0 ? 'No Limit' : formatNumberToReadableString(value)
  }`
}

const formatRooms = (
  label: string,
  ids: string[] | null | undefined,
  fallback = 'No rooms'
) => {
  if (!ids || !ids.length) return `- **${label}**: ${fallback}`

  const formattedIds = ids.map((id) => `  - <#${id}> (${id})`).join('\n')
  return `- **${label}**:\n${formattedIds}`
}

const formatCategory = (
  label: string,
  id: string,
  fallback = 'No category'
) => {
  if (!id) return `- **${label}**: ${fallback}`

  return ` - **${label}**: <#${id}> (${id})`
}

const formatAtmRooms = (
  label: string,
  ids?: { actions?: string; logs?: string } | null
) => {
  if (!ids) return `- **${label}**: No rooms`

  const actions = ids.actions
    ? `<#${ids.actions}> (${ids.actions})`
    : 'No channel'
  const logs = ids.logs ? `<#${ids.logs}> (${ids.logs})` : 'No channel'

  return `- **${label}**\n  - Actions: ${actions}\n  - Logs: ${logs}`
}

const formatRole = (label: string, id?: string | null) => {
  return `- **${label}:** ${id ? `<@&${id}> (${id})` : 'No role'}`
}

const renderSection = (
  title: string,
  baseLines: string[],
  adminLines?: string[],
  isAdmin?: boolean
) => {
  const lines: string[] = []
  if (isAdmin && adminLines?.length) lines.push(...adminLines)
  lines.push(...baseLines)
  return `## ${title}\n${lines.join('\n')}`
}

export async function run({ interaction }: SlashCommandProps) {
  const config = await GuildConfiguration.findOne({
    guildId: interaction.guildId,
  })

  const vipRooms = await VipRoom.find(
    { guildId: interaction.guildId },
    { channelId: 1, _id: 0 }
  )
  const vipChannelIds = vipRooms.map((room) => room.channelId)

  const settings = config?.casinoSettings

  if (!settings) return

  const isAdmin = interaction.options.getBoolean('admin') ?? false

  const games = [
    renderSection(
      '🎲 Dice',
      [
        `- **Multiplier:** ${settings.dice.winMultiplier}x`,
        formatBet('Max Bet', settings.dice.maxBet),
        formatBet('Min Bet', settings.dice.minBet),
      ],
      [formatRTP(calculateRTP('dice', settings.dice))],
      isAdmin
    ),
    renderSection(
      '🪙 Coin Flip',
      [
        `- **Multiplier:** ${settings.coinflip.winMultiplier}x`,
        formatBet('Max Bet', settings.coinflip.maxBet),
        formatBet('Min Bet', settings.coinflip.minBet),
      ],
      [formatRTP(calculateRTP('coinflip', settings.coinflip))],
      isAdmin
    ),
    renderSection(
      '🎰 Slots',
      [
        `- **Multipliers:** \n${Object.entries(settings.slots.winMultipliers)
          .map(([symbol, multiplier]) => `  - ${symbol}: ${multiplier}x`)
          .join('\n')}`,
        formatBet('Max Bet', settings.slots.maxBet),
        formatBet('Min Bet', settings.slots.minBet),
      ],
      [
        formatRTP(calculateRTP('slots', settings.slots)),
        `- **Symbol Weights:** \n${Object.entries(settings.slots.symbolWeights)
          .map(([symbol, weight]) => `  - ${symbol}: ${weight}`)
          .join('\n')}`,
      ],
      isAdmin
    ),
    renderSection(
      '🎟️ Lottery',
      [
        `- **Multipliers:** \n${Object.entries(settings.lottery.winMultipliers)
          .map(([symbol, multiplier]) => `  - ${symbol}: ${multiplier}x`)
          .join('\n')}`,
        formatBet('Max Bet', settings.lottery.maxBet),
        formatBet('Min Bet', settings.lottery.minBet),
      ],
      [formatRTP(calculateRTP('lottery', settings.lottery))],
      isAdmin
    ),
    renderSection(
      '🤑 Golden Jackpot',
      [
        `- **Multiplier:** ${formatNumberWithSpaces(
          settings.goldenJackpot.winMultiplier
        )}x`,
        formatBet('Max Bet', settings.goldenJackpot.maxBet),
        formatBet('Min Bet', settings.goldenJackpot.minBet),
      ],
      [
        formatRTP(calculateRTP('goldenJackpot', settings.goldenJackpot)),
        `- **One in Chance:** 1 in ${formatNumberWithSpaces(
          settings.goldenJackpot.oneInChance
        )}`,
      ],
      isAdmin
    ),
    renderSection(
      '🪨📄✂️ RPS',
      [
        `- **Casino Cut:** ${settings.rps.casinoCut * 100}%`,
        formatBet('Max Bet', settings.rps.maxBet),
        formatBet('Min Bet', settings.rps.minBet),
      ],
      [formatRTP(calculateRTP('rps', settings.rps))],
      isAdmin
    ),
    renderSection(
      '🃏 Blackjack',
      [
        formatBet('Max Bet', settings.blackjack.maxBet),
        formatBet('Min Bet', settings.blackjack.minBet),
      ],
      [formatRTP(calculateRTP('blackjack', settings.blackjack))],
      isAdmin
    ),
    renderSection(
      '⚙️ Server Config',
      [
        formatRole('VIP Role', config.vipSettings.roleId),
        `- **VIP Price Per Day:** ${
          config.vipSettings.pricePerDay === 0
            ? 'Not Set'
            : `$${formatNumberToReadableString(config.vipSettings.pricePerDay)}`
        }`,
        `- **VIP Create Price:** ${
          config.vipSettings.pricePerCreate === 0
            ? 'Not Set'
            : `$${formatNumberToReadableString(
                config.vipSettings.pricePerCreate
              )}`
        }`,
        '',
        formatRole('Manager Role', config.managerRoleId),
      ],
      [
        formatAtmRooms('ATM Rooms', config.atmChannelIds),
        formatRooms('Gambling Rooms', config.casinoChannelIds),
        formatRooms('Admin Rooms', config.adminChannelIds),
        formatRooms('VIP Active Rooms', vipChannelIds),
        '',
        formatCategory('VIP Category', config.vipSettings.categoryId),
      ],
      isAdmin
    ),
  ]

  return interaction.reply({
    content: `# ${isAdmin ? 'Admin' : ''} Casino Information\n${games.join(
      '\n\n'
    )}`,
  })
}
