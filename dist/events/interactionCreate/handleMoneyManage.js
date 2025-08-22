"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const User_1 = require("../../models/User");
const utils_1 = require("../../utils/utils");
const GuildConfiguration_1 = require("../../models/GuildConfiguration");
const createEmbed_1 = require("../../utils/createEmbed");
exports.default = async (interaction, client) => {
    if (!interaction.isButton() || !interaction.customId)
        return;
    try {
        const [type, amount] = interaction.customId.split('.');
        if (type !== 'give-money' && type !== 'reset-money')
            return;
        const guildConfiguration = await GuildConfiguration_1.default.findOne({
            guildId: interaction.guildId,
        });
        if (!guildConfiguration?.atmChannelIds.logs) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Not Configured', 'ATM logs are not configured yet.\nPlease contact an administrator to complete the setup.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const user = await User_1.default.findOne({
            userId: interaction.user.id,
            guildId: interaction.guildId,
        });
        if (!user) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Not registered', 'You are not registered yet.\nUse the `/register` command to register.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (type === 'give-money') {
            if (!amount)
                return;
            const parsedAmount = parseInt(amount);
            user.balance += parsedAmount;
            user.save();
            const logChannel = client.channels.cache.get(guildConfiguration.atmChannelIds.logs);
            logChannel
                .send({
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setTitle('ATM - Money Generator')
                        .setDescription(`<@${interaction.user.id}> has added **$${(0, utils_1.formatNumberToReadableString)(parsedAmount)}** to their account.`)
                        .setColor('DarkGreen'),
                ],
            })
                .catch(console.error);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('ATM - Money Generator')
                .setDescription(`Server has added **$${(0, utils_1.formatNumberToReadableString)(parsedAmount)}** to your account.\nYour new balance is **$${(0, utils_1.formatNumberToReadableString)(user.balance)}**.`)
                .setColor('DarkGreen');
            await interaction.reply({
                embeds: [embed],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (type === 'reset-money') {
            user.balance = 0;
            user.save();
            const logChannel = client.channels.cache.get(guildConfiguration.atmChannelIds.logs);
            logChannel
                .send({
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setTitle('ATM - Money Reset')
                        .setDescription(`<@${interaction.user.id}> has reset their account balance.`)
                        .setColor('DarkRed'),
                ],
            })
                .catch(console.error);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('ATM - Money Reset')
                .setDescription(`Server has reset your account balance.\nYour new balance is **$${(0, utils_1.formatNumberToReadableString)(user.balance)}**.`)
                .setColor('DarkRed');
            await interaction.reply({
                embeds: [embed],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
    }
    catch (error) {
        console.error('Error in handleGiveMoney.ts', error);
    }
};
