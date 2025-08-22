"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const User_1 = require("../../../models/User");
const utils_1 = require("../../../utils/utils");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
exports.default = async (interaction, client) => {
    if (!interaction.isButton() || !interaction.customId)
        return;
    try {
        const [type, amount] = interaction.customId.split('.');
        if (!type || !amount)
            return;
        if (type !== 'give-money')
            return;
        const guildConfiguration = await GuildConfiguration_1.default.findOne({
            guildId: interaction.guildId,
        });
        if (!guildConfiguration?.atmChannelIds.logs) {
            return await interaction.reply({
                content: 'ATM log channel is not set.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const parsedAmount = parseInt(amount);
        const user = await User_1.default.findOne({
            userId: interaction.user.id,
            guildId: interaction.guildId,
        });
        if (!user)
            return;
        user.balance += parsedAmount;
        user.save();
        const logChannel = client.channels.cache.get(guildConfiguration.atmChannelIds.logs);
        logChannel
            .send({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setTitle('ATM - Money Generator')
                    .setDescription(`<@${interaction.user.id}> has added **$${(0, utils_1.formatNumberToReadableString)(parsedAmount)}** to their account.`)
                    .setColor('Gold'),
            ],
        })
            .catch(console.error);
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('ATM - Money Generator')
            .setDescription(`Server has added **$${(0, utils_1.formatNumberToReadableString)(parsedAmount)}** to your account.\nYour new balance is **$${(0, utils_1.formatNumberToReadableString)(user.balance)}**.`)
            .setColor('Gold');
        await interaction.reply({
            embeds: [embed],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
    catch (error) {
        console.error('Error in handlePrediction.ts', error);
    }
};
