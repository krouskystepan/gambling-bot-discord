"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const GuildConfiguration_1 = require("../../models/GuildConfiguration");
const gambling_bot_shared_1 = require("gambling-bot-shared");
exports.default = async (client) => {
    for (const guild of client.guilds.cache.values()) {
        let dbSettings = await GuildConfiguration_1.default.findOne({ guildId: guild.id });
        if (!dbSettings) {
            await GuildConfiguration_1.default.create({
                guildId: guild.id,
                casinoSettings: gambling_bot_shared_1.defaultCasinoSettings,
            });
            console.log(`🆕 Created settings => ${guild.name} (${guild.id})`);
            continue;
        }
        const mergedSettings = (0, lodash_1.merge)({}, gambling_bot_shared_1.defaultCasinoSettings, dbSettings.casinoSettings);
        if (JSON.stringify(dbSettings.casinoSettings) !==
            JSON.stringify(mergedSettings)) {
            dbSettings.casinoSettings = mergedSettings;
            await dbSettings.save();
            console.log(`🔧 Updated settings => ${guild.name} (${guild.id})`);
        }
    }
};
