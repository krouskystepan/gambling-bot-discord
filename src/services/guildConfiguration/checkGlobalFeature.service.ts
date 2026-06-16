import {
  GlobalFeature,
  TGuildConfiguration,
  isGlobalFeatureDisabled
} from 'gambling-bot-shared/guild'

import { MessageFlags, PermissionFlagsBits } from 'discord.js'

import { createErrorEmbed } from '@/utils/discord/createEmbed'

/** Duck-typed repliable interaction (avoids duplicate discord.js typings from commandkit). */
export type RepliableInteractionLike = {
  user: { id: string }
  guild: {
    members: {
      fetch: (id: string) => Promise<{
        permissions: { has: (permission: bigint) => boolean }
      } | null>
    }
  } | null
  replied: boolean
  deferred: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- structural type for commandkit + button interactions
  reply: (...args: any[]) => Promise<unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editReply: (...args: any[]) => Promise<unknown>
}

const FEATURE_MESSAGES: Record<GlobalFeature, string> = {
  registration: 'New user registration is disabled on this server.',
  deposit: 'Deposits are disabled on this server.',
  withdraw: 'Withdrawals are disabled on this server.',
  casinoGames: 'Casino games are disabled on this server.',
  casinoGamesForMods: 'Mod casino tools are disabled on this server.',
  predictions: 'Prediction betting is disabled on this server.',
  predictionManagement: 'Prediction management is disabled on this server.',
  raffles: 'Raffle ticket purchases are disabled on this server.',
  raffleManagement: 'Raffle management is disabled on this server.',
  dailyBonus: 'The daily bonus is disabled on this server.',
  vip: 'VIP features are disabled on this server.',
  maintenance: 'This server is in maintenance mode.'
}

const replyDisabled = async (
  interaction: RepliableInteractionLike,
  feature: GlobalFeature
) => {
  const title =
    feature === 'maintenance'
      ? 'Error - Maintenance'
      : 'Error - Feature Disabled'

  const payload = {
    embeds: [createErrorEmbed(title, FEATURE_MESSAGES[feature])],
    flags: MessageFlags.Ephemeral
  }

  if (interaction.replied || interaction.deferred) {
    await interaction.editReply(payload)
  } else {
    await interaction.reply(payload)
  }
}

export const canBypassMaintenance = async (
  interaction: RepliableInteractionLike
): Promise<boolean> => {
  const member = await interaction.guild?.members
    .fetch(interaction.user.id)
    .catch(() => null)
  return member?.permissions.has(PermissionFlagsBits.Administrator) ?? false
}

export const assertNotMaintenance = async (
  interaction: RepliableInteractionLike,
  config: TGuildConfiguration
): Promise<boolean> => {
  if (!isGlobalFeatureDisabled(config, 'maintenance')) return true
  if (await canBypassMaintenance(interaction)) return true
  await replyDisabled(interaction, 'maintenance')
  return false
}

export const assertGlobalFeature = async (
  interaction: RepliableInteractionLike,
  config: TGuildConfiguration | null | undefined,
  feature: GlobalFeature
): Promise<boolean> => {
  if (!isGlobalFeatureDisabled(config, feature)) return true

  if (feature === 'maintenance' && (await canBypassMaintenance(interaction))) {
    return true
  }

  await replyDisabled(interaction, feature)
  return false
}
