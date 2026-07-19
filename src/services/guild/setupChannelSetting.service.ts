import { MessageFlags } from 'discord.js'

import { ChatInputCommand } from 'commandkit'

import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'

import { assertModMaintenanceAllowed } from './assertModMaintenance.service'
import {
  createGuildConfiguration,
  getGuildConfigByGuildId
} from './guildConfiguration.db'

type SetupInteraction = Parameters<ChatInputCommand>[0]['interaction']

type GuildConfigurationDoc = NonNullable<
  Awaited<ReturnType<typeof getGuildConfigByGuildId>>
>

export type ChannelSetupMessages = {
  titleAdd: string
  titleRemove: string
  alreadySet: (channel: { id: string; toString(): string }) => string
  addSuccess: (channel: { id: string; toString(): string }) => string
  notSet: (channelId: string) => string
  removeSuccess: (channelId: string) => string
}

export type ChannelSetupMode =
  | {
      kind: 'scalar'
      get: (config: GuildConfigurationDoc) => string
      set: (config: GuildConfigurationDoc, channelId: string) => void
      clear: (config: GuildConfigurationDoc) => void
    }
  | {
      kind: 'list'
      get: (config: GuildConfigurationDoc) => string[]
      set: (config: GuildConfigurationDoc, channelIds: string[]) => void
    }

export const resolveGuildConfigurationForSetup = async (
  interaction: SetupInteraction
): Promise<GuildConfigurationDoc | null> => {
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
    return null
  }

  return guildConfiguration
}

export const handleChannelSetup = async ({
  interaction,
  guildConfiguration,
  op,
  mode,
  messages
}: {
  interaction: SetupInteraction
  guildConfiguration: GuildConfigurationDoc
  op: 'add' | 'remove'
  mode: ChannelSetupMode
  messages: ChannelSetupMessages
}): Promise<void> => {
  if (op === 'add') {
    const channel = interaction.options.getChannel('channel', true)

    if (mode.kind === 'scalar') {
      if (mode.get(guildConfiguration) === channel.id) {
        await interaction.reply({
          embeds: [
            createErrorEmbed(messages.titleAdd, messages.alreadySet(channel))
          ],
          flags: MessageFlags.Ephemeral
        })
        return
      }
      mode.set(guildConfiguration, channel.id)
    } else {
      if (mode.get(guildConfiguration).includes(channel.id)) {
        await interaction.reply({
          embeds: [
            createErrorEmbed(messages.titleAdd, messages.alreadySet(channel))
          ],
          flags: MessageFlags.Ephemeral
        })
        return
      }
      mode.set(guildConfiguration, [
        ...mode.get(guildConfiguration),
        channel.id
      ])
    }

    await guildConfiguration.save()

    await interaction.reply({
      embeds: [
        createSuccessEmbed(messages.titleAdd, messages.addSuccess(channel))
      ]
    })
    return
  }

  const channelId = interaction.options.getString('channel-id', true)

  if (mode.kind === 'scalar') {
    if (mode.get(guildConfiguration) !== channelId) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(messages.titleRemove, messages.notSet(channelId))
        ],
        flags: MessageFlags.Ephemeral
      })
      return
    }
    mode.clear(guildConfiguration)
  } else {
    if (!mode.get(guildConfiguration).includes(channelId)) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(messages.titleRemove, messages.notSet(channelId))
        ],
        flags: MessageFlags.Ephemeral
      })
      return
    }
    mode.set(
      guildConfiguration,
      mode.get(guildConfiguration).filter((id) => id !== channelId)
    )
  }

  await guildConfiguration.save()

  await interaction.reply({
    embeds: [
      createSuccessEmbed(
        messages.titleRemove,
        messages.removeSuccess(channelId)
      )
    ]
  })
}
