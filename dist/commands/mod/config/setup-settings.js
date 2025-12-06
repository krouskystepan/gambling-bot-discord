"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
const createEmbed_1 = require("../../../utils/createEmbed");
const utils_1 = require("../../../utils/utils");
const gambling_bot_shared_1 = require("gambling-bot-shared");
const GAMES = [
    { name: 'All', value: 'all' },
    { name: 'Dice', value: 'dice' },
    { name: 'Coinflip', value: 'coinflip' },
    { name: 'Slots', value: 'slots' },
    { name: 'Lottery', value: 'lottery' },
    { name: 'RPS', value: 'rps' },
    { name: 'Golden Jackpot', value: 'goldenJackpot' },
    { name: 'Blackjack', value: 'blackjack' },
    { name: 'Prediction', value: 'prediction' },
];
exports.data = {
    name: 'setup-settings',
    description: 'Manage the casino settings (max, min bets and win %).',
    options: [
        {
            name: 'edit',
            description: 'Edit the games settings.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'game',
                    description: 'Game to configure',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                    choices: GAMES,
                },
                {
                    name: 'key',
                    description: 'Select the setting to update.',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true,
                },
                {
                    name: 'value',
                    description: 'New value. NOTE: Be sure to enter a correct value.',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
        {
            name: 'reset',
            description: 'Reset the casino settings to default values.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'game',
                    description: 'Game to reset',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: false,
                    choices: GAMES,
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
    devOnly: true,
};
async function run({ interaction }) {
    try {
        let guildConfiguration = await GuildConfiguration_1.default.findOne({
            guildId: interaction.guildId,
        });
        if (!guildConfiguration || !guildConfiguration.casinoSettings) {
            guildConfiguration = new GuildConfiguration_1.default({
                guildId: interaction.guildId,
                casinoSettings: gambling_bot_shared_1.defaultCasinoSettings,
            });
        }
        const options = interaction.options;
        const subCommand = options.getSubcommand();
        if (subCommand === 'edit') {
            const game = options.getString('game', true);
            const value = options.getString('value', true);
            const key = options.getString('key', true);
            if (!guildConfiguration.casinoSettings[game]) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Game', 'The game you provided is not valid.\nPlease make sure you enter a valid game name.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            if (!(key in guildConfiguration.casinoSettings[game])) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Setting', 'The setting you provided is not valid.\nPlease make sure you enter a valid setting name.\n\n> ***Note:** After changing the game a second time within the same command. Please retype the command from scratch to refresh the options. (This is a Discord API bug).*'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            // This will cover casinoCut
            if (value.endsWith('%')) {
                const valueAsNumber = parseFloat(value.slice(0, -1)) * 0.01;
                if (valueAsNumber < 0 || valueAsNumber > 1) {
                    return interaction.reply({
                        embeds: [
                            (0, createEmbed_1.createInfoEmbed)('Invalid Input - Out of Range', 'The number you provided must be between 10% and 90%.\nPlease enter a positive value.'),
                        ],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                }
                guildConfiguration.casinoSettings[game][key] = valueAsNumber;
                guildConfiguration.markModified('casinoSettings');
                await guildConfiguration.save();
                return await interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createSuccessEmbed)('Casino Settings Updated', `The setting **${gambling_bot_shared_1.readableGameValueNames.find((value) => value.value === key)
                            ?.name}** for **${game.toUpperCase()}** has been updated to **${(0, utils_1.formatNumberToPercentage)(valueAsNumber)}**.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            // This will cover winMultiplier for just a number
            if (value.endsWith('x')) {
                const valueAsNumber = parseFloat(value.slice(0, -1));
                guildConfiguration.casinoSettings[game][key] = valueAsNumber;
                guildConfiguration.markModified('casinoSettings');
                await guildConfiguration.save();
                return await interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createSuccessEmbed)('Casino Settings Updated', `The setting **${gambling_bot_shared_1.readableGameValueNames.find((value) => value.value === key)
                            ?.name}** for **${game.toUpperCase()}** has been updated to **${valueAsNumber}x**.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            // This will cover maxBet, minBet
            if (value.toLocaleLowerCase().endsWith('k') ||
                value.toLocaleLowerCase().endsWith('m') ||
                value.toLocaleLowerCase().endsWith('b') ||
                value.toLocaleLowerCase().startsWith('*')) {
                const parsedValue = (0, utils_1.parseReadableStringToNumber)(value.startsWith('*') ? value.slice(1) : value);
                if (isNaN(parsedValue)) {
                    return interaction.reply({
                        embeds: [
                            (0, createEmbed_1.createInfoEmbed)('Invalid Input - Not a number', 'The value you entered is not a valid number.\nPlease make sure you enter a numerical value.'),
                        ],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                }
                if (parsedValue <= 0) {
                    return interaction.reply({
                        embeds: [
                            (0, createEmbed_1.createInfoEmbed)('Invalid Input - Non-positive number', 'The number you provided must be greater than 0.\nPlease enter a positive value.'),
                        ],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                }
                if (key === 'minBet' &&
                    parsedValue > guildConfiguration.casinoSettings[game].maxBet) {
                    return interaction.reply({
                        embeds: [
                            (0, createEmbed_1.createInfoEmbed)('Invalid Input - Above Maximum Bet', `The minimum bet cannot be greater than the maximum bet of **$${(0, utils_1.formatNumberToReadableString)(guildConfiguration.casinoSettings[game].maxBet)}**.`),
                        ],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                }
                guildConfiguration.casinoSettings[game][key] = parsedValue;
                guildConfiguration.markModified('casinoSettings');
                await guildConfiguration.save();
                return await interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createSuccessEmbed)('Casino Settings Updated', `The setting ${key} for ${game} has been updated to **${(0, utils_1.formatNumberToReadableString)(parsedValue)}**.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            if (value.includes(':')) {
                const [objKey, valueAsNumber] = value.split(':');
                const parsedValue = (0, utils_1.parseReadableStringToNumber)(valueAsNumber);
                if (isNaN(parsedValue)) {
                    return interaction.reply({
                        embeds: [
                            (0, createEmbed_1.createInfoEmbed)('Invalid Input - Not a number', 'The value you entered is not a valid number.\nPlease make sure you enter a numerical value.'),
                        ],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                }
                if (guildConfiguration.casinoSettings[game][key][objKey] === undefined) {
                    return interaction.reply({
                        embeds: [
                            (0, createEmbed_1.createInfoEmbed)('Invalid Input - Not a valid object key', 'The object key you entered is not valid.\nPlease make sure you enter a valid object key.'),
                        ],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                }
                guildConfiguration.casinoSettings[game][key][objKey] = parsedValue;
                guildConfiguration.markModified('casinoSettings');
                await guildConfiguration.save();
                return await interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createSuccessEmbed)('Casino Settings Updated', `The setting **${gambling_bot_shared_1.readableGameValueNames.find((value) => value.value === key)
                            ?.name}** for **${game.toUpperCase()}** has been updated: **Multiplier for value ${objKey} is now ${valueAsNumber}x**.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Casino Settings', [
                        'To update a value, use one of the following formats:',
                        '- `%` for percentages (e.g., `12.5%`)',
                        '',
                        '- `x` for multipliers (e.g., `1.5x`)',
                        '',
                        '- `k` for thousands (e.g., `10k` = 10 000)',
                        '- `m` for millions (e.g., `2m` = 2 000 000)',
                        '- `b` for billions (e.g., `1b` = 1 000 000 000)',
                        '- `*` for custom values (e.g., `*500` = 500, `*1250` = 1250)',
                        '',
                        '- `:` for object keys (e.g. `key:value`, `🔔🔔🔔:3` = Mult for value `🔔🔔🔔` is `3x`, `4:2` = Mult for number `4` is `2x`)',
                    ].join('\n')),
                ],
            });
        }
        if (subCommand === 'reset') {
            const game = options.getString('game');
            if (game === 'all') {
                guildConfiguration.casinoSettings = gambling_bot_shared_1.defaultCasinoSettings;
                guildConfiguration.markModified('casinoSettings');
                await guildConfiguration.save();
                return await interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createSuccessEmbed)('Casino Settings Reset', 'All casino settings have been reset to default values.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            if (game) {
                guildConfiguration.casinoSettings[game] =
                    gambling_bot_shared_1.defaultCasinoSettings[game];
                guildConfiguration.markModified('casinoSettings');
                await guildConfiguration.save();
                return await interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createSuccessEmbed)('Casino Settings Reset', `The casino settings for **${game.toUpperCase()}** have been reset to default values.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
        }
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
