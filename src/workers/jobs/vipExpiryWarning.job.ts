import { VipExpiryWarningTier } from 'gambling-bot-shared/vip'

import { ChannelType } from 'discord.js'

import { Client } from 'commandkit'

import {
  getVipsNeedingExpiryWarning,
  markVipExpiryWarningSent
} from '@/services'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import { sleep } from '@/utils/common/utils'
import { createInfoEmbed } from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

const WARNING_TIERS: readonly VipExpiryWarningTier[] = ['24h', '1h']

const createWarningMessage = (
  tier: VipExpiryWarningTier,
  expiresAt: Date
): { title: string; description: string } => {
  const relativeExpiry = `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`

  if (tier === '24h') {
    return {
      title: 'VIP Expiring Soon',
      description: `Your VIP channel expires ${relativeExpiry}. Renew it with \`/vip extend\` if you want to keep access.`
    }
  }

  return {
    title: 'VIP Expiring Very Soon',
    description: `Your VIP channel expires ${relativeExpiry}. Renew it with \`/vip extend\` soon if you want to keep access.`
  }
}

export const vipExpiryWarningJob = async (client: Client<true>) => {
  let sent24h = 0
  let sent1h = 0
  const guildSummary = new Map<string, { sent24h: number; sent1h: number }>()

  for (const tier of WARNING_TIERS) {
    const rooms = await getVipsNeedingExpiryWarning(tier)

    for (const room of rooms) {
      try {
        const guild = await client.guilds.fetch(room.guildId).catch(() => null)
        if (!guild) continue

        const channel = await guild.channels
          .fetch(room.channelId)
          .catch(() => null)
        if (!channel || channel.type !== ChannelType.GuildText) continue

        const warningMessage = createWarningMessage(tier, room.expiresAt)

        await channel.send({
          content: `<@${room.ownerId}>`,
          embeds: [
            createInfoEmbed(warningMessage.title, warningMessage.description)
          ]
        })

        await markVipExpiryWarningSent({
          ownerId: room.ownerId,
          guildId: room.guildId,
          tier
        })

        if (tier === '24h') {
          sent24h++
        } else {
          sent1h++
        }

        const summary = guildSummary.get(room.guildId) ?? {
          sent24h: 0,
          sent1h: 0
        }
        if (tier === '24h') {
          summary.sent24h++
        } else {
          summary.sent1h++
        }
        guildSummary.set(room.guildId, summary)

        await sleep(500)
      } catch (error) {
        logger.error(
          `VIP expiry warning failed for channel ${room.channelId} (${tier})`,
          error
        )
      }
    }
  }

  const totalSent = sent24h + sent1h
  if (totalSent > 0) {
    logger.worker(
      `VIP expiry warning: sent ${totalSent} (24h: ${sent24h}, 1h: ${sent1h})`
    )

    for (const [guildId, summary] of guildSummary) {
      const total = summary.sent24h + summary.sent1h
      await postWorkerLog(client, {
        guildId,
        worker: 'VIP expiry warning',
        title: `Sent ${total} warning(s)`,
        description: `24h warnings: **${summary.sent24h}**\n1h warnings: **${summary.sent1h}**`,
        level: 'warning'
      })
    }
  }
}
