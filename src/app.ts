import 'dotenv/config'

import { Client, GatewayIntentBits } from 'discord.js'

import '@/bootstrap/logging'

import { connectToDatabase } from './services'

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

connectToDatabase()

export default client
