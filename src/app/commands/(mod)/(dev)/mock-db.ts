import { parseReadableStringToNumber } from 'gambling-bot-shared/common'

import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  MOCK_SCALE_PRESETS,
  type MockDbEntity,
  parseMockScale,
  runMockDb
} from '@/services/dev'
import { assertDevAccess, devCommandMetadata } from '@/utils/devAccess'

export const command: CommandData = {
  name: 'mock-db',
  description:
    'Seed the database with realistic mock data for Admin testing (dev only).',
  options: [
    {
      name: 'all',
      description:
        'Fill all collections (users, txs, ATM, raffles, predictions, VIP).',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'scale',
          description: 'Preset size (default: small).',
          type: ApplicationCommandOptionType.String,
          required: false,
          choices: [
            { name: 'Small (~30 users, ~800 txs)', value: 'small' },
            { name: 'Medium (~80 users, ~4k txs)', value: 'medium' },
            { name: 'Large (~200 users, ~20k txs)', value: 'large' }
          ]
        },
        {
          name: 'max-amount',
          description: 'Max transaction/bet amount (default: 1000).',
          type: ApplicationCommandOptionType.String,
          required: false
        },
        {
          name: 'include-guild-users',
          description:
            'Mix in real guild/DB users (default: false — synthetic users only).',
          type: ApplicationCommandOptionType.Boolean,
          required: false
        }
      ]
    },
    {
      name: 'entity',
      description: 'Fill a single collection.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'target',
          description: 'Which data to generate.',
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: [
            { name: 'Users only', value: 'users' },
            { name: 'Transactions only', value: 'transactions' },
            { name: 'ATM requests only', value: 'atm' },
            { name: 'Raffles only', value: 'raffles' },
            { name: 'Predictions only', value: 'predictions' },
            { name: 'VIP rooms only', value: 'vip' }
          ]
        },
        {
          name: 'scale',
          description: 'Preset size (default: small).',
          type: ApplicationCommandOptionType.String,
          required: false,
          choices: [
            { name: 'Small (~30 users, ~800 txs)', value: 'small' },
            { name: 'Medium (~80 users, ~4k txs)', value: 'medium' },
            { name: 'Large (~200 users, ~20k txs)', value: 'large' }
          ]
        },
        {
          name: 'max-amount',
          description: 'Max transaction/bet amount (default: 1000).',
          type: ApplicationCommandOptionType.String,
          required: false
        },
        {
          name: 'include-guild-users',
          description:
            'Mix in real guild/DB users (default: false — synthetic users only).',
          type: ApplicationCommandOptionType.Boolean,
          required: false
        }
      ]
    },
    {
      name: 'custom',
      description: 'Fill all collections with custom counts.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'users',
          description: 'Number of mock users (default: scale preset).',
          type: ApplicationCommandOptionType.Integer,
          required: false,
          min_value: 1,
          max_value: 500
        },
        {
          name: 'transactions',
          description: 'Number of transactions (default: scale preset).',
          type: ApplicationCommandOptionType.Integer,
          required: false,
          min_value: 1,
          max_value: 500_000
        },
        {
          name: 'atm-requests',
          description: 'Number of ATM requests (default: scale preset).',
          type: ApplicationCommandOptionType.Integer,
          required: false,
          min_value: 0,
          max_value: 1000
        },
        {
          name: 'raffles',
          description: 'Number of raffles (default: scale preset).',
          type: ApplicationCommandOptionType.Integer,
          required: false,
          min_value: 0,
          max_value: 100
        },
        {
          name: 'predictions',
          description: 'Number of predictions (default: scale preset).',
          type: ApplicationCommandOptionType.Integer,
          required: false,
          min_value: 0,
          max_value: 200
        },
        {
          name: 'vip-rooms',
          description: 'Number of VIP rooms (default: scale preset).',
          type: ApplicationCommandOptionType.Integer,
          required: false,
          min_value: 0,
          max_value: 100
        },
        {
          name: 'days',
          description: 'Spread data over N past days (default: scale preset).',
          type: ApplicationCommandOptionType.Integer,
          required: false,
          min_value: 1,
          max_value: 365
        },
        {
          name: 'scale',
          description: 'Preset size (default: small).',
          type: ApplicationCommandOptionType.String,
          required: false,
          choices: [
            { name: 'Small (~30 users, ~800 txs)', value: 'small' },
            { name: 'Medium (~80 users, ~4k txs)', value: 'medium' },
            { name: 'Large (~200 users, ~20k txs)', value: 'large' }
          ]
        },
        {
          name: 'max-amount',
          description: 'Max transaction/bet amount (default: 1000).',
          type: ApplicationCommandOptionType.String,
          required: false
        },
        {
          name: 'include-guild-users',
          description:
            'Mix in real guild/DB users (default: false — synthetic users only).',
          type: ApplicationCommandOptionType.Boolean,
          required: false
        }
      ]
    }
  ],
  dm_permission: false
}

export const metadata: CommandMetadata = devCommandMetadata

function getSubcommandEntity(subcommand: string): MockDbEntity {
  if (subcommand === 'entity') {
    return 'users'
  }
  return 'all'
}

function readCommonOptions(
  interaction: Parameters<ChatInputCommand>[0]['interaction']
) {
  const scale = parseMockScale(interaction.options.getString('scale'))
  const maxAmount = parseReadableStringToNumber(
    interaction.options.getString('max-amount') || '1000'
  )
  const includeGuildUsers =
    interaction.options.getBoolean('include-guild-users') ?? false

  return { scale, maxAmount, includeGuildUsers }
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    if (!(await assertDevAccess(interaction))) return

    if (!interaction.guild) {
      return interaction.reply({
        content: '⚠️ This command must be used in a guild.',
        flags: MessageFlags.Ephemeral
      })
    }

    const subcommand = interaction.options.getSubcommand(true)
    const { scale, maxAmount, includeGuildUsers } =
      readCommonOptions(interaction)

    let entity: MockDbEntity = getSubcommandEntity(subcommand)
    let presetOverride:
      | Partial<(typeof MOCK_SCALE_PRESETS)['small']>
      | undefined

    if (subcommand === 'entity') {
      entity = interaction.options.getString('target', true) as MockDbEntity
    }

    if (subcommand === 'custom') {
      const base = MOCK_SCALE_PRESETS[scale]
      presetOverride = {
        users: interaction.options.getInteger('users') ?? base.users,
        transactions:
          interaction.options.getInteger('transactions') ?? base.transactions,
        atmRequests:
          interaction.options.getInteger('atm-requests') ?? base.atmRequests,
        raffles: interaction.options.getInteger('raffles') ?? base.raffles,
        predictions:
          interaction.options.getInteger('predictions') ?? base.predictions,
        vipRooms: interaction.options.getInteger('vip-rooms') ?? base.vipRooms,
        days: interaction.options.getInteger('days') ?? base.days
      }
    }

    await interaction.deferReply()

    const summary = await runMockDb({
      guildId: interaction.guildId!,
      invokingUserId: interaction.user.id,
      entity,
      scale,
      preset: presetOverride,
      maxAmount,
      useGuildUsers: includeGuildUsers,
      guild: interaction.guild
    })

    const preset = { ...MOCK_SCALE_PRESETS[scale], ...presetOverride }
    const userSource = includeGuildUsers
      ? 'guild / DB + synthetic'
      : 'synthetic (works solo on server)'

    await interaction.editReply({
      content:
        `✅ Mock DB **${entity}** (${summary.scale} scale)\n` +
        `👥 **${summary.users}** user pool (${userSource})\n` +
        `🗓️ Spread over **${preset.days}** days\n\n` +
        summary.lines.join('\n')
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
