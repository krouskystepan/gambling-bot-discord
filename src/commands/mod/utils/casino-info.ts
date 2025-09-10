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
      name: 'games',
      description: 'Show information about casino games',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
    {
      name: 'config',
      description: 'Show server casino configuration',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
    {
      name: 'admin',
      description:
        'Show administrator-only information (contains sensitive data)',
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
  return `- **RTP:** ${rtp.toFixed(2)}%`
}

const formatBet = (label: string, value: number) => {
  const parsedValue = parseFloat(value as unknown as string)

  return `- **${label}:** ${
    parsedValue === 0 ? 'No Limit' : formatNumberToReadableString(parsedValue)
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

  return `- **${label}**: <#${id}> (${id})`
}

const formatMultipleRooms = (
  label: string,
  ids?: { actions?: string | string[]; logs?: string | string[] } | null
) => {
  if (!ids) return `- **${label}**: No rooms`

  const formatField = (value?: string | string[]) => {
    if (!value || (Array.isArray(value) && value.length === 0))
      return 'No channel'
    return Array.isArray(value)
      ? value.map((id) => `<#${id}> (${id})`).join(', ')
      : value.trim() === ''
      ? 'No channel'
      : `<#${value}> (${value})`
  }

  const actions = formatField(ids.actions)
  const logs = formatField(ids.logs)

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
  if (!config?.casinoSettings) return

  const vipRooms = await VipRoom.find(
    { guildId: interaction.guildId },
    { channelId: 1, _id: 0 }
  )
  const vipChannelIds = vipRooms.map((room) => room.channelId)

  const settings = config.casinoSettings

  const showGames = interaction.options.getBoolean('games') ?? true
  const showConfig = interaction.options.getBoolean('config') ?? true
  const showAdmin = interaction.options.getBoolean('admin') ?? false

  const sections: string[] = []

  if (showGames) {
    sections.push(
      renderSection(
        '🎲 Dice',
        [
          `- **Multiplier:** ${settings.dice.winMultiplier}x`,
          formatBet('Max Bet', settings.dice.maxBet),
          formatBet('Min Bet', settings.dice.minBet),
        ],
        [formatRTP(calculateRTP('dice', settings.dice))],
        showAdmin
      ),
      renderSection(
        '🪙 Coin Flip',
        [
          `- **Multiplier:** ${settings.coinflip.winMultiplier}x`,
          formatBet('Max Bet', settings.coinflip.maxBet),
          formatBet('Min Bet', settings.coinflip.minBet),
        ],
        [formatRTP(calculateRTP('coinflip', settings.coinflip))],
        showAdmin
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
          `- **Symbol Weights:** \n${Object.entries(
            settings.slots.symbolWeights
          )
            .map(([symbol, weight]) => `  - ${symbol}: ${weight}`)
            .join('\n')}`,
        ],
        showAdmin
      ),
      renderSection(
        '🎟️ Lottery',
        [
          `- **Multipliers:** \n${Object.entries(
            settings.lottery.winMultipliers
          )
            .map(([symbol, multiplier]) => `  - ${symbol}: ${multiplier}x`)
            .join('\n')}`,
          formatBet('Max Bet', settings.lottery.maxBet),
          formatBet('Min Bet', settings.lottery.minBet),
        ],
        [formatRTP(calculateRTP('lottery', settings.lottery))],
        showAdmin
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
        showAdmin
      ),
      renderSection(
        '🪨📄✂️ RPS',
        [
          `- **Casino Cut:** ${settings.rps.casinoCut * 100}%`,
          formatBet('Max Bet', settings.rps.maxBet),
          formatBet('Min Bet', settings.rps.minBet),
        ],
        [formatRTP(calculateRTP('rps', settings.rps))],
        showAdmin
      ),
      renderSection(
        '🃏 Blackjack',
        [
          formatBet('Max Bet', settings.blackjack.maxBet),
          formatBet('Min Bet', settings.blackjack.minBet),
        ],
        [formatRTP(calculateRTP('blackjack', settings.blackjack))],
        showAdmin
      ),
      renderSection('👀 Prediction', [
        formatBet('Max Bet', settings.prediction.maxBet),
        formatBet('Min Bet', settings.prediction.minBet),
      ])
    )
  }

  if (showConfig) {
    sections.push(
      renderSection(
        '⚙️ Server Config',
        [
          formatRole('VIP Role', config.vipSettings.roleId),
          `- **VIP Price Per Day:** ${
            config.vipSettings.pricePerDay === 0
              ? 'Not Set'
              : `$${formatNumberToReadableString(
                  config.vipSettings.pricePerDay
                )}`
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
          formatMultipleRooms('ATM Rooms', config.atmChannelIds),
          formatMultipleRooms('Prediction Rooms', config.predictionChannelIds),
          formatRooms('Gambling Rooms', config.casinoChannelIds),
          formatRooms('Transaction Room', [config.transactionChannelId]),
          formatRooms('VIP Active Rooms', vipChannelIds),
          '',
          formatCategory('VIP Category', config.vipSettings.categoryId),
        ],
        showAdmin
      )
    )
  }

  const content =
    sections.length > 0
      ? `# Casino Information\n${sections.join('\n\n')}`
      : `# Casino Information\n- No information selected.`

  return interaction.reply({ content })
}
