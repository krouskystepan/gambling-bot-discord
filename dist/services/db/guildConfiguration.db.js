import { defaultCasinoSettings } from 'gambling-bot-shared';
import GuildConfiguration from '@/models/GuildConfiguration';
export const getGuildConfigByGuildId = async ({ guildId }) => {
    return GuildConfiguration.findOne({ guildId });
};
export const createGuildConfiguration = async ({ guildId }) => {
    const guildConfiguration = await GuildConfiguration.create({
        guildId,
        casinoSettings: defaultCasinoSettings
    });
    return guildConfiguration;
};
