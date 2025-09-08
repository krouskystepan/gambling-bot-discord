"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const User_1 = require("../../../models/User");
const utils_1 = require("../../../utils/utils");
exports.default = async (interaction, client) => {
    if (!interaction.isButton() || !interaction.customId)
        return;
    try {
        const [type, action, confirm, details, amount] = interaction.customId.split('.');
        if (type !== 'atm')
            return;
        if (!action || !action || !confirm || !details || !amount)
            return;
        const [userId, messageId] = details.split('-');
        if (!userId || !messageId)
            return;
        const user = await User_1.default.findOne({
            userId,
            guildId: interaction.guildId,
        });
        if (!user)
            return;
        const parsedAmount = parseInt(amount);
        if (action === 'approve') {
            if (confirm === '_') {
                const confirmButton = new discord_js_1.ButtonBuilder()
                    .setCustomId(`atm.approve.confirm.${interaction.user.id}-${messageId}.${parsedAmount}`)
                    .setLabel('Confirm Deposit')
                    .setStyle(discord_js_1.ButtonStyle.Success);
                const row = new discord_js_1.ActionRowBuilder().addComponents(confirmButton);
                await interaction.reply({
                    content: 'Are you sure?',
                    components: [row],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            if (confirm === 'confirm') {
                user.balance += parsedAmount;
                await user.save();
                if (messageId) {
                    try {
                        const logChannel = (await client.channels.fetch(interaction.channelId));
                        if (logChannel) {
                            const logMessage = await logChannel.messages.fetch(messageId);
                            if (logMessage) {
                                await logMessage.edit({
                                    content: 'Approved ✅',
                                    components: [],
                                });
                            }
                        }
                    }
                    catch (err) {
                        console.error('Failed to remove buttons from log message', err);
                    }
                }
                await interaction.update({
                    content: `Deposit of **$${(0, utils_1.formatNumberToReadableString)(parsedAmount)}** successful!`,
                    components: [],
                });
            }
        }
        if (action === 'reject') {
            if (confirm === '_') {
                const confirmButton = new discord_js_1.ButtonBuilder()
                    .setCustomId(`atm.reject.confirm.${interaction.user.id}-${messageId}.${parsedAmount}`)
                    .setLabel('Confirm Reject')
                    .setStyle(discord_js_1.ButtonStyle.Danger);
                const row = new discord_js_1.ActionRowBuilder().addComponents(confirmButton);
                await interaction.reply({
                    content: 'Are you sure?',
                    components: [row],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            if (confirm === 'confirm') {
                if (messageId) {
                    try {
                        const logChannel = (await client.channels.fetch(interaction.channelId));
                        if (logChannel) {
                            const logMessage = await logChannel.messages.fetch(messageId);
                            if (logMessage) {
                                await logMessage.edit({
                                    content: 'Rejected ❌',
                                    components: [],
                                });
                            }
                        }
                    }
                    catch (err) {
                        console.error('Failed to remove buttons from log message', err);
                    }
                }
                await interaction.update({
                    content: `Deposit of **$${(0, utils_1.formatNumberToReadableString)(parsedAmount)}** successful!`,
                    components: [],
                });
            }
        }
    }
    catch (error) {
        console.error('Error in handleGiveMoney.ts', error);
    }
};
