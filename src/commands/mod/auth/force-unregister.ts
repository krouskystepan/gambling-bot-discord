import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  MessageFlags,
  TextChannel,
} from 'discord.js'
import { checkUserRegistration } from '../../../utils/utils'
import GuildConfiguration from '../../../models/GuildConfiguration'
import {
  createErrorEmbed,
  createSuccessEmbed,
} from '../../../utils/createEmbed'

export const data: CommandData = {
  name: 'force-unregister',
  description: 'Unregister a user (delete from DB).',
  options: [
    {
      name: 'user-id',
      description: 'The ID of the user you want to unregister.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  dm_permission: false,
}

export const options: CommandOptions = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  deleted: false,
}

export async function run({ interaction, client }: SlashCommandProps) {
  try {
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

    const userId = interaction.options.getString('user-id', true)

    const registeredUser = await checkUserRegistration(
      userId,
      guildConfiguration.guildId
    )

    if (!registeredUser) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'ATM Error - Not Registered.',
            'User is not registered yet.'
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
            .setTitle('ATM - User Unregistered')
            .setDescription(
              `Manager <@${interaction.user.id}> has unregistered the user with ID ${userId}.`
            )
            .setColor('NotQuiteBlack'),
        ],
      })
      .catch(console.error)

    await registeredUser.deleteOne()

    return interaction.reply({
      embeds: [
        createSuccessEmbed(
          'ATM Success - Unregistered',
          `The user with ID ${userId} has been successfully unregistered.`
        ),
      ],
      flags: MessageFlags.Ephemeral,
    })
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
