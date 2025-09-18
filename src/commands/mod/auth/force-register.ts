import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  MessageFlags,
  TextChannel,
} from 'discord.js'
import User from '../../../models/User'
import GuildConfiguration from '../../../models/GuildConfiguration'
import {
  createErrorEmbed,
  createSuccessEmbed,
} from '../../../utils/createEmbed'

export const data: CommandData = {
  name: 'force-register',
  description: 'Force register a user.',
  options: [
    {
      name: 'user',
      description: 'The user you want to register.',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
  ],
  dm_permission: false,
}

export const options: CommandOptions = {
  deleted: true,
}

export async function run({ interaction, client }: SlashCommandProps) {
  try {
    const guildConfig = await GuildConfiguration.findOne({
      guildId: interaction.guildId,
    })

    if (!guildConfig?.atmChannelIds.logs) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Logs Not Set Up',
            'ATM logs are not configured yet.\nPlease contact an administrator to complete the setup.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const user = interaction.options.getUser('user', true)

    const newUser = await User.findOneAndUpdate(
      { userId: user.id, guildId: interaction.guildId },
      { $setOnInsert: { balance: 0, lockedBalance: 0 } },
      { new: true, upsert: true }
    )

    if (!newUser.isNew) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'ATM Error - Already Registered',
            'User is already registered in the system.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const logChannel = client.channels.cache.get(
      guildConfig.atmChannelIds.logs
    ) as TextChannel

    logChannel
      ?.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('ATM - User Registered')
            .setDescription(
              `Manager <@${interaction.user.id}> has successfully registered <@${user.id}>.`
            )
            .setColor('Grey'),
        ],
      })
      .catch(console.error)

    return interaction.reply({
      embeds: [
        createSuccessEmbed(
          'ATM Success - Registered',
          'The user has been successfully registered in the system.'
        ),
      ],
      flags: MessageFlags.Ephemeral,
    })
  } catch (error) {
    console.error('Error running /force-register:', error)
  }
}
