"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
const gambling_bot_shared_1 = require("@krouskystepan/gambling-bot-shared");
exports.default = async (interaction, client) => {
    if (!interaction.isAutocomplete())
        return;
    if (interaction.commandName !== 'setup-settings')
        return;
    const focusedOption = interaction.options.getFocused(true);
    const game = interaction.options.getString('game');
    const focusedValue = focusedOption.value;
    if (!game)
        return;
    const config = await GuildConfiguration_1.default.findOne({
        guildId: interaction.guildId,
    });
    const gameSettings = config?.casinoSettings?.[game];
    if (!gameSettings)
        return;
    const settingKeys = Object.keys(gameSettings);
    const filteredChoices = gambling_bot_shared_1.readableGameValueNames
        .filter((val) => settingKeys.includes(val.value))
        .filter((val) => val.name.toLowerCase().startsWith(focusedValue.toLowerCase()));
    await interaction.respond(filteredChoices).catch(() => { });
};
