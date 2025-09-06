"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
const createEmbed_1 = require("../../../utils/createEmbed");
exports.data = {
    name: 'setup-manager',
    description: 'Manage the manager role.',
    options: [
        {
            name: 'set-role',
            description: 'Set the manager role.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'role',
                    description: 'The role you want to set as manager.',
                    type: discord_js_1.ApplicationCommandOptionType.Role,
                    required: true,
                },
            ],
        },
        {
            name: 'remove',
            description: 'Remove the manager role using its ID.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'role-id',
                    description: 'The ID of the role you want to remove.',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
    ],
    dm_permission: false,
};
exports.options = {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
    deleted: true,
};
async function run({ interaction }) {
    try {
        let guildConfiguration = await GuildConfiguration_1.default.findOne({
            guildId: interaction.guildId,
        });
        if (!guildConfiguration) {
            guildConfiguration = new GuildConfiguration_1.default({
                guildId: interaction.guildId,
            });
        }
        const options = interaction.options;
        const subcommand = options.getSubcommand();
        if (subcommand === 'set-role') {
            const role = options.getRole('role', true);
            if (guildConfiguration.managerRoleId === role.id) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Manager Role Setup - Set', `The manager role is already set to ${role}.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            guildConfiguration.managerRoleId = role.id;
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('Manager Role Setup - Set', `Manager role has been set to ${role}.`),
                ],
            });
        }
        if (subcommand === 'remove') {
            const roleId = options.getString('role-id', true);
            if (guildConfiguration.managerRoleId !== roleId) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Manager Role Setup - Remove', `Role with ID ${roleId} is not set as manager role.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            guildConfiguration.managerRoleId = '';
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('Manager Role Setup - Remove', `Manager role with ID ${roleId} has been successfully removed.`),
                ],
            });
        }
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
