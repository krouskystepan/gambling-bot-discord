"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const User_1 = require("../../../models/User");
const utils_1 = require("../../../utils/utils");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
const createEmbed_1 = require("../../../utils/createEmbed");
const Transaction_1 = require("../../../models/Transaction");
exports.default = async (interaction, client) => {
    if (!interaction.isButton() || !interaction.customId)
        return;
    try {
        const [type, action, confirm, details, amountStr] = interaction.customId.split('.');
        if (!type || !action || !confirm || !details || !amountStr)
            return;
        const [userId, messageId] = details.split('-');
        if (!userId || !messageId)
            return;
        const [atmType, atmAction] = type.split('-');
        if (atmType !== 'atm')
            return;
        const parsedAmount = parseInt(amountStr);
        if (isNaN(parsedAmount))
            return;
        const member = await interaction.guild?.members.fetch(interaction.user.id);
        const guildConfig = await GuildConfiguration_1.default.findOne({
            guildId: interaction.guildId,
        });
        const managerRoleId = guildConfig?.managerRoleId;
        if (!member?.roles.cache.has(managerRoleId || '') &&
            !member?.permissions.has(discord_js_1.PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Permission Denied', `You need to be an **Administrator** or have the ${managerRoleId ? `<@&${managerRoleId}>` : '**Manager role**'} to perform this action.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const user = await User_1.default.findOne({ userId, guildId: interaction.guildId });
        if (!user)
            return;
        const guildConfiguration = await GuildConfiguration_1.default.findOne({
            guildId: interaction.guildId,
        });
        if (!guildConfiguration?.atmChannelIds.actions) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Not Configured', 'ATM actions are not configured yet.\nPlease contact an administrator to complete the setup.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const actionChannel = client.channels.cache.get(guildConfiguration.atmChannelIds.actions);
        const updateLogMessage = async (content) => {
            try {
                const logChannel = (await client.channels.fetch(interaction.channelId));
                const logMessage = await logChannel.messages.fetch(messageId);
                await logMessage.edit({ content, components: [] });
            }
            catch (err) {
                console.error('Failed to update log message', err);
            }
        };
        const sendConfirmation = async (label, style, customIdSuffix) => {
            const button = new discord_js_1.ButtonBuilder()
                .setCustomId(customIdSuffix)
                .setLabel(label)
                .setStyle(style);
            const row = new discord_js_1.ActionRowBuilder().addComponents(button);
            await interaction.reply({
                content: 'Are you sure?',
                components: [row],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        };
        const sendMessageToUser = async (isApproved, atmAction, amount, targetUserId) => {
            const readableAmount = `$${(0, utils_1.formatNumberToReadableString)(amount)}`;
            const embed = isApproved
                ? (0, createEmbed_1.createSuccessEmbed)('Transaction Approved ✅', `${atmAction === 'deposit' ? 'Deposit' : 'Withdraw'} of **${readableAmount}** has been approved.`)
                : (0, createEmbed_1.createErrorEmbed)('Transaction Rejected ❌', `${atmAction === 'deposit' ? 'Deposit' : 'Withdraw'} of **${readableAmount}** has been rejected.`);
            await actionChannel
                .send({
                content: `<@${targetUserId}>`,
                embeds: [embed],
            })
                .catch(console.error);
        };
        if (action === 'approve' && confirm === '_') {
            return await sendConfirmation(atmAction === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdraw', discord_js_1.ButtonStyle.Success, `atm-${atmAction}.approve.confirm.${userId}-${messageId}.${parsedAmount}`);
        }
        if (action === 'reject' && confirm === '_') {
            return await sendConfirmation('Confirm Reject', discord_js_1.ButtonStyle.Danger, `atm-${atmAction}.reject.confirm.${userId}-${messageId}.${parsedAmount}`);
        }
        if (confirm === 'confirm') {
            await User_1.default.findOneAndUpdate({ userId: user.userId, guildId: user.guildId }, {
                $inc: {
                    balance: (action === 'approve' && atmAction === 'deposit') ||
                        (action === 'reject' && atmAction === 'withdraw')
                        ? parsedAmount
                        : 0,
                },
            });
            if (action === 'approve') {
                await Transaction_1.default.create({
                    userId: user.userId,
                    guildId: user.guildId,
                    amount: parsedAmount,
                    type: atmAction,
                    source: 'manual',
                    handledBy: interaction.user.id,
                    createdAt: new Date(),
                });
            }
            await updateLogMessage(`${action === 'approve' ? 'Approved' : 'Rejected'} by <@${interaction.user.id}> ${action === 'approve' ? '✅' : '❌'}`);
            await sendMessageToUser(action === 'approve', atmAction, parsedAmount, userId);
            return await interaction.update({
                content: `${atmAction.charAt(0).toUpperCase() + atmAction.slice(1)} of **$${(0, utils_1.formatNumberToReadableString)(parsedAmount)}** ${action === 'approve' ? 'successful' : 'rejected'}!`,
                components: [],
            });
        }
    }
    catch (error) {
        console.error('Error in handleAtm.ts', error);
    }
};
