"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInfoEmbed = exports.createErrorEmbed = exports.createSuccessEmbed = exports.createBetEmbed = void 0;
const discord_js_1 = require("discord.js");
const createBetEmbed = (title, color, description, id) => {
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setDescription(description);
    if (id) {
        embed.setFooter({ text: `ID: ${id}` });
    }
    return embed;
};
exports.createBetEmbed = createBetEmbed;
const createSuccessEmbed = (title, description) => {
    return new discord_js_1.EmbedBuilder()
        .setTitle(title)
        .setColor('Green')
        .setDescription(description);
};
exports.createSuccessEmbed = createSuccessEmbed;
const createErrorEmbed = (title, description) => {
    return new discord_js_1.EmbedBuilder()
        .setTitle(title)
        .setColor('Red')
        .setDescription(description);
};
exports.createErrorEmbed = createErrorEmbed;
const createInfoEmbed = (title, description) => {
    return new discord_js_1.EmbedBuilder()
        .setTitle(title)
        .setColor('Blue')
        .setDescription(description);
};
exports.createInfoEmbed = createInfoEmbed;
