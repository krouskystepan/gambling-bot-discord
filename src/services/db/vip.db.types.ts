import { TVipRoom } from 'gambling-bot-shared/vip'

export type TCreateVip = Pick<
  TVipRoom,
  'ownerId' | 'guildId' | 'channelId' | 'expiresAt'
>
export type TGetVip = Pick<TVipRoom, 'guildId' | 'ownerId'>
