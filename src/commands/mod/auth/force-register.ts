import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  MessageFlags,
  TextChannel
} from 'discord.js'

import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import { forceCreateUser, getGuildConfigByGuildId } from '@/services'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'

export const data: CommandData = {
  name: 'force-register',
  description: 'Force register a user.',
  options: [
    {
      name: 'user',
      description: 'The user you want to register.',
      type: ApplicationCommandOptionType.User,
      required: true
    }
  ],
  dm_permission: false
}

export const options: CommandOptions = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  deleted: false
}

export async function run({ interaction, client }: SlashCommandProps) {
  try {
    const guildConfig = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })

    if (!guildConfig?.atmChannelIds.logs) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Logs Not Set Up',
            'ATM logs are not configured yet.\nPlease contact an administrator to complete the setup.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const user = interaction.options.getUser('user', true)

    const createdUser = await forceCreateUser({
      userId: user.id,
      guildId: interaction.guildId!
    })

    if (!createdUser) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'ATM Error - Already Registered',
            'User is already registered in the system.'
          )
        ],
        flags: MessageFlags.Ephemeral
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
            .setColor('Grey')
        ]
      })
      .catch(console.error)

    return interaction.reply({
      embeds: [
        createSuccessEmbed(
          'ATM Success - Registered',
          'The user has been successfully registered in the system.'
        )
      ],
      flags: MessageFlags.Ephemeral
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
