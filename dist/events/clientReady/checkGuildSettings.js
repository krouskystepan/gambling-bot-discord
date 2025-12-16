import { defaultCasinoSettings } from 'gambling-bot-shared';
import merge from 'lodash/merge';
import { createGuildConfiguration, getGuildConfigByGuildId } from '@/services';
export default async (client) => {
    for (const guild of client.guilds.cache.values()) {
        let dbSettings = await await getGuildConfigByGuildId({
            guildId: guild.id
        });
        if (!dbSettings) {
            await createGuildConfiguration({ guildId: guild.id });
            console.log(`🆕 Created settings => ${guild.name} (${guild.id})`);
            continue;
        }
        const mergedSettings = merge({}, defaultCasinoSettings, dbSettings.casinoSettings);
        if (JSON.stringify(dbSettings.casinoSettings) !==
            JSON.stringify(mergedSettings)) {
            dbSettings.casinoSettings = mergedSettings;
            await dbSettings.save();
            console.log(`🔧 Updated settings => ${guild.name} (${guild.id})`);
        }
    }
};
