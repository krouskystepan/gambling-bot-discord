import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import { formatMockWorkerReplyMessages } from '@/services/dev/formatMockWorkerReply'
import {
  type WorkerMockEntity,
  runMockWorkerDb
} from '@/services/dev/mockWorkerDb'
import { assertDevAccess, devCommandMetadata } from '@/utils/devAccess'

const WORKER_TARGETS: { name: string; value: WorkerMockEntity }[] = [
  {
    name: 'Locked balance orphans',
    value: 'locked-balance'
  },
  {
    name: 'Blackjack idle nudge (3h+ idle)',
    value: 'blackjack-idle-nudge'
  },
  {
    name: 'Blackjack auto-stand (24h+ idle)',
    value: 'blackjack-autostand'
  },
  {
    name: 'VIP expired rooms',
    value: 'vip-expired'
  },
  {
    name: 'VIP expiry warnings (24h / 1h)',
    value: 'vip-expiry-warning'
  },
  {
    name: 'Predictions past autolock',
    value: 'prediction-autolock'
  },
  {
    name: 'Raffles ready to draw',
    value: 'raffle-draw'
  }
]

export const command: CommandData = {
  name: 'mock-worker-db',
  description:
    'Seed intentionally broken DB state to test background workers (dev only).',
  options: [
    {
      name: 'all',
      description: 'Seed every worker scenario in the database.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'count',
          description: 'Items per worker type (default: 1, max: 5).',
          type: ApplicationCommandOptionType.Integer,
          required: false,
          min_value: 1,
          max_value: 5
        }
      ]
    },
    {
      name: 'entity',
      description: 'Seed a single worker scenario.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'target',
          description: 'Which worker scenario to seed.',
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: WORKER_TARGETS
        },
        {
          name: 'count',
          description: 'How many items to seed (default: 1, max: 5).',
          type: ApplicationCommandOptionType.Integer,
          required: false,
          min_value: 1,
          max_value: 5
        },
        {
          name: 'vip-warning-tier',
          description:
            'For VIP expiry warnings only: 24h, 1h, or both (default: both).',
          type: ApplicationCommandOptionType.String,
          required: false,
          choices: [
            { name: '24h warning', value: '24h' },
            { name: '1h warning', value: '1h' },
            { name: 'Both tiers', value: 'both' }
          ]
        }
      ]
    }
  ],
  dm_permission: false
}

export const metadata: CommandMetadata = devCommandMetadata

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
    const count = interaction.options.getInteger('count') ?? undefined
    const entity: WorkerMockEntity =
      subcommand === 'entity'
        ? (interaction.options.getString('target', true) as WorkerMockEntity)
        : 'all'

    const vipWarningTier =
      (interaction.options.getString('vip-warning-tier') as
        | 'both'
        | '24h'
        | '1h'
        | null) ?? 'both'

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const summary = await runMockWorkerDb({
      guildId: interaction.guildId!,
      invokingUserId: interaction.user.id,
      entity,
      count,
      vipWarningTier
    })

    const messages = formatMockWorkerReplyMessages(summary, count)

    await interaction.editReply({ content: messages[0] })

    for (const chunk of messages.slice(1)) {
      await interaction.followUp({
        content: chunk,
        flags: MessageFlags.Ephemeral
      })
    }
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
