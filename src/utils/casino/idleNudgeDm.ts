import type { Client } from 'commandkit'

import { createWarningEmbed } from '@/utils/discord/createEmbed'

/** Discord message jump link for a casino session message. */
export const casinoGameMessageLink = ({
  guildId,
  channelId,
  messageId
}: {
  guildId: string
  channelId: string
  messageId: string
}) => `https://discord.com/channels/${guildId}/${channelId}/${messageId}`

/**
 * Sends an idle-session reminder privately. Never posts in a guild channel.
 * Returns false when the DM cannot be delivered (e.g. user has DMs closed).
 */
export const sendCasinoIdleNudgeDm = async ({
  client,
  userId,
  title,
  body,
  gameId
}: {
  client: Client<true>
  userId: string
  title: string
  body: string
  gameId: string
}): Promise<boolean> => {
  const user = await client.users.fetch(userId).catch(() => null)
  if (!user) return false

  try {
    await user.send({
      embeds: [createWarningEmbed(title, body, gameId)]
    })
    return true
  } catch {
    return false
  }
}
