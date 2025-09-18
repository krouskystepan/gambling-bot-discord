import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import { EmbedBuilder, MessageFlags, TextChannel } from 'discord.js'
import User from '../../../models/User'
import GuildConfiguration from '../../../models/GuildConfiguration'
import {
  createErrorEmbed,
  createSuccessEmbed,
} from '../../../utils/createEmbed'

export const data: CommandData = {
  name: 'register',
  description: 'Register yourself in the system.',
  dm_permission: false,
}

export const options: CommandOptions = {
  deleted: false,
}

export async function run({ interaction, client }: SlashCommandProps) {
  try {
    const guildConfiguration = await GuildConfiguration.findOne({
      guildId: interaction.guildId,
    })

    if (
      !guildConfiguration?.atmChannelIds?.logs ||
      !guildConfiguration?.atmChannelIds?.actions
    ) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Not Configured',
            'ATM logs or actions are not configured yet.\nPlease contact an administrator to complete the setup.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (guildConfiguration.atmChannelIds.actions !== interaction.channelId) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Incorrect Channel',
            `This command can only be used in <#${guildConfiguration.atmChannelIds.actions}>.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const result = await User.findOneAndUpdate(
      {
        userId: interaction.user.id,
        guildId: interaction.guildId,
      },
      { $setOnInsert: { balance: 0, lockedBalance: 0 } },
      { new: true, upsert: true }
    )

    const wasAlreadyRegistered =
      result &&
      result.createdAt &&
      result.updatedAt &&
      result.createdAt < result.updatedAt

    if (wasAlreadyRegistered) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'ATM Error - Registered',
            'You are already registered in the system.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const logChannel = client.channels.cache.get(
      guildConfiguration.atmChannelIds.logs
    ) as TextChannel

    logChannel
      .send({
        embeds: [
          new EmbedBuilder()
            .setTitle('ATM - User Registration')
            .setDescription(
              `User <@${interaction.user.id}> has successfully registered in the system.`
            )
            .setColor('White'),
        ],
      })
      .catch(console.error)

    return interaction.reply({
      embeds: [
        createSuccessEmbed(
          'ATM Success - Registered',
          'You have been successfully registered in the system.'
        ),
      ],
      flags: MessageFlags.Ephemeral,
    })
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
