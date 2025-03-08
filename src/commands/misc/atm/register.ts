import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import { checkUserRegistration } from '../../../utils/utils'
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
  contexts: [0],
}

export const options: CommandOptions = {
  deleted: false,
}

export async function run({ interaction, client }: SlashCommandProps) {
  try {
    const user = await checkUserRegistration(
      interaction.user.id,
      interaction.guildId!
    )

    if (user) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'ATM Error - Registered.',
            'You are already registered in the system.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const guildConfiguration = await GuildConfiguration.findOne({
      guildId: interaction.guildId,
    })

    if (!guildConfiguration?.atmChannelIds.logs) {
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

    if (!guildConfiguration?.atmChannelIds.actions) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Actions Not Configured',
            'This ATM command has not been set up yet.\nPlease contact an administrator to complete the setup.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (guildConfiguration?.atmChannelIds.actions !== interaction.channelId) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Incorrect Channel',
            `This command can only be used in <#${guildConfiguration.atmChannelIds.actions}>.\nPlease use the correct channel to proceed.`
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

    const newUser = new User({
      userId: interaction.user.id,
      guildId: interaction.guildId,
    })

    await newUser.save()

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
