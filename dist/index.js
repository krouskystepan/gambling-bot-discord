"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const discord_js_1 = require("discord.js");
const utils_1 = require("./utils/utils");
const commandkit_1 = require("commandkit");
const path = require("path");
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMembers,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
    ],
});
async function startApp(client) {
    await (0, utils_1.connectToDatabase)();
    new commandkit_1.CommandKit({
        client,
        commandsPath: path.join(__dirname, 'commands'),
        eventsPath: path.join(__dirname, 'events'),
        bulkRegister: true,
    });
    await client.login(process.env.TOKEN);
}
startApp(client);
