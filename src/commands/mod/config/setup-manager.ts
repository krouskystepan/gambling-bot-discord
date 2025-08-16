import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import {
  ApplicationCommandOptionType,
  CommandInteractionOptionResolver,
  MessageFlags,
} from 'discord.js'
import GuildConfiguration from '../../../models/GuildConfiguration'
import {
  createErrorEmbed,
  createSuccessEmbed,
} from '../../../utils/createEmbed'

export const data: CommandData = {
  name: 'setup-manager',
  description: 'Manage the manager role.',
  options: [
    {
      name: 'set',
      description: 'Set the manager role.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'role',
          description: 'The role you want to set as manager.',
          type: ApplicationCommandOptionType.Role,
          required: true,
        },
      ],
    },
    {
      name: 'remove',
      description: 'Remove the manager role.',
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
  dm_permission: false,
}

export const options: CommandOptions = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  deleted: false,
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    let guildConfiguration = await GuildConfiguration.findOne({
      guildId: interaction.guildId,
    })

    if (!guildConfiguration) {
      guildConfiguration = new GuildConfiguration({
        guildId: interaction.guildId,
      })
    }

    const options = interaction.options as CommandInteractionOptionResolver
    const subcommand = options.getSubcommand()

    if (subcommand === 'set') {
      const role = options.getRole('role', true)

      guildConfiguration.managerRoleId = role.id
      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Manager Role Setup - Set',
            `Manager role has been set to ${role}.`
          ),
        ],
      })
    }

    if (subcommand === 'remove') {
      if (!guildConfiguration.managerRoleId) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Manager Role Setup - Remove',
              'No manager role is currently set.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      guildConfiguration.managerRoleId = ''
      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Manager Role Setup - Remove',
            `The manager role has been successfully removed.`
          ),
        ],
      })
    }
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
