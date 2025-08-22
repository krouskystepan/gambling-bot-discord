"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const utils_1 = require("../../../utils/utils");
const discord_js_1 = require("discord.js");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
const createEmbed_1 = require("../../../utils/createEmbed");
exports.data = {
    name: 'deposit',
    description: 'Deposit money to your account.',
    options: [
        {
            name: 'amount',
            description: 'The amount you want to deposit (e.g., 1000, 2k, 10.5k).',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: true,
        },
        {
            name: 'account',
            description: 'The account from which you are sending money.',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: true,
        },
    ],
    dm_permission: false,
};
exports.options = {
    deleted: false,
};
async function run({ interaction, client }) {
    try {
        const user = await (0, utils_1.checkUserRegistration)(interaction.user.id, interaction.guildId);
        if (!user) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Not registered', 'You are not registered yet.\nUse the `/register` command to register.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const guildConfiguration = await GuildConfiguration_1.default.findOne({
            guildId: interaction.guildId,
        });
        if (!guildConfiguration?.atmChannelIds.logs) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Logs Not Set Up', 'ATM logs are not configured yet.\nPlease contact an administrator to complete the setup.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (!guildConfiguration?.atmChannelIds.actions) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Actions Not Configured', 'This ATM command has not been set up yet.\nPlease contact an administrator to complete the setup.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (guildConfiguration?.atmChannelIds.actions !== interaction.channelId) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Incorrect Channel', `This command can only be used in <#${guildConfiguration.atmChannelIds.actions}>.\nPlease use the correct channel to proceed.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const account = interaction.options.getString('account', true);
        const amount = interaction.options.getString('amount', true);
        const parsedAmount = (0, utils_1.parseReadableStringToNumber)(amount);
        const readableAmount = (0, utils_1.formatNumberToReadableString)(parsedAmount);
        if (isNaN(parsedAmount)) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input - Not a number', 'The value you entered is not a valid number.\nPlease make sure you enter a numerical value.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (parsedAmount <= 0) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input - Non-positive number', 'The number you provided must be greater than 0.\nPlease enter a positive value.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const logChannel = client.channels.cache.get(guildConfiguration.atmChannelIds.logs);
        logChannel
            .send({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setTitle('ATM - Deposit')
                    .setColor('Green')
                    .setDescription(`<@${interaction.user.id}> has deposited **$${readableAmount}** from account **${account}**.`),
            ],
        })
            .then((message) => {
            message.react('✅');
        })
            .catch(console.error);
        return interaction.reply({
            embeds: [
                (0, createEmbed_1.createSuccessEmbed)('ATM - Deposit', `You have successfully deposited **$${readableAmount}** to your account.\nPlease wait for the transaction to be processed.`),
            ],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
