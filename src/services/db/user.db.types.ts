import { TUser } from 'gambling-bot-shared/user'

export type TCreateUser = Pick<TUser, 'userId' | 'guildId'>
export type TGetUser = Pick<TUser, 'userId' | 'guildId'>
