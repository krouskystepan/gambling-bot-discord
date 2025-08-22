"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const GuildConfiguration_1 = require("../src/models/GuildConfiguration");
exports.data = {
    name: 'setup-prediction',
    description: 'Správa kanálů pro předpovědi.',
    options: [
        {
            name: 'add',
            description: 'Nastav kanál pro používání předpovědí.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel',
                    description: 'Kanál, který chceš nastavit pro používání předpovědí.',
                    type: discord_js_1.ApplicationCommandOptionType.Channel,
                    channel_types: [discord_js_1.ChannelType.GuildText],
                    required: true,
                },
            ],
        },
        {
            name: 'remove',
            description: 'Odeber kanál pro používání předpovědí skrze ID.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel-id',
                    description: 'ID kanálu, který chceš odebrat z používání předpovědí.',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
    ],
    contexts: [0],
};
exports.options = {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
    deleted: false,
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
        if (subcommand === 'add') {
            const channel = interaction.options.getChannel('channel', true);
            guildConfiguration.predictionChannelIds.push(channel.id);
            await guildConfiguration.save();
            return interaction.reply({
                content: `Kanál ${channel} byl úspěšně nastaven pro používání předpovědí.`,
            });
        }
        if (subcommand === 'remove') {
            const channelId = options.getString('channel-id', true);
            if (!guildConfiguration.predictionChannelIds.includes(channelId)) {
                return await interaction.reply(`Kanál s ID ${channelId} není nastavený pro předpovědi.`);
            }
            guildConfiguration.predictionChannelIds =
                guildConfiguration.predictionChannelIds.filter((id) => id !== channelId);
            await guildConfiguration.save();
            return interaction.reply(`Kanál s ID ${channelId} byl úspěšně odebrán z používání předpovědí.`);
        }
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
