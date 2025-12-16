import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, GatewayIntentBits } from 'discord.js';
import { CommandKit } from 'commandkit';
import { connectToDatabase } from './services';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});
async function startApp(client) {
    await connectToDatabase();
    new CommandKit({
        client,
        commandsPath: path.join(__dirname, 'commands'),
        eventsPath: path.join(__dirname, 'events'),
        devGuildIds: ['1298805664654561340'],
        devUserIds: ['563799503056928768'],
        bulkRegister: true
    });
    await client.login(process.env.TOKEN);
}
startApp(client);
