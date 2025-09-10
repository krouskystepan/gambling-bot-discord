"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const createEmbed_1 = require("../../../utils/createEmbed");
exports.data = {
    name: 'ping',
    description: 'Check the bot latency.',
};
exports.options = {
    deleted: false,
};
async function run({ interaction, client }) {
    await interaction.deferReply();
    const reply = await interaction.fetchReply();
    const ping = reply.createdTimestamp - interaction.createdTimestamp;
    interaction.editReply({
        embeds: [
            (0, createEmbed_1.createSuccessEmbed)('Pong! 🏓', `**・** Klient: \`${ping}ms\` \n **・** Websocket: \`${client.ws.ping}ms\``),
        ],
    });
}
