import { EmbedBuilder } from 'discord.js';
export const createBetEmbed = (title, color, description, id) => {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setDescription(description);
    if (id) {
        embed.setFooter({ text: `ID: ${id}` });
    }
    return embed;
};
export const createSuccessEmbed = (title, description) => {
    return new EmbedBuilder()
        .setTitle(title)
        .setColor('Green')
        .setDescription(description);
};
export const createErrorEmbed = (title, description) => {
    return new EmbedBuilder()
        .setTitle(title)
        .setColor('Red')
        .setDescription(description);
};
export const createInfoEmbed = (title, description) => {
    return new EmbedBuilder()
        .setTitle(title)
        .setColor('Blue')
        .setDescription(description);
};
