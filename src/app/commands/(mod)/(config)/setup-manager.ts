import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  assertModMaintenanceAllowed,
  createGuildConfiguration,
  getGuildConfigByGuildId
} from '@/services'
import { DEV_GUILDS } from '@/utils/devGuilds'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'setup-manager',
  description: 'Manage the manager role.',
  options: [
    {
      name: 'set-role',
      description: 'Set the manager role.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'role',
          description: 'The role you want to set as manager.',
          type: ApplicationCommandOptionType.Role,
          required: true
        }
      ]
    },
    {
      name: 'remove',
      description: 'Remove the manager role using its ID.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'role-id',
          description: 'The ID of the role you want to remove.',
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
    }
  ],
  dm_permission: false
}

export const metadata: CommandMetadata = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  guilds: DEV_GUILDS
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    let guildConfiguration = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })

    if (!guildConfiguration) {
      guildConfiguration = await createGuildConfiguration({
        guildId: interaction.guildId!
      })
    } else if (
      (await assertModMaintenanceAllowed(interaction, interaction.guildId!)) ===
      false
    ) {
      return
    }

    const options = interaction.options
    const subcommand = options.getSubcommand()

    if (subcommand === 'set-role') {
      const role = options.getRole('role', true)

      if (guildConfiguration.managerRoleId === role.id) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Manager Role Setup - Set',
              `The manager role is already set to ${role}.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      guildConfiguration.managerRoleId = role.id
      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Manager Role Setup - Set',
            `Manager role has been set to ${role}.`
          )
        ]
      })
    }

    if (subcommand === 'remove') {
      const roleId = options.getString('role-id', true)

      if (guildConfiguration.managerRoleId !== roleId) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Manager Role Setup - Remove',
              `Role with ID ${roleId} is not set as manager role.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      guildConfiguration.managerRoleId = ''
      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Manager Role Setup - Remove',
            `Manager role with ID ${roleId} has been successfully removed.`
          )
        ]
      })
    }
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
