import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import {
  ApplicationCommandOptionType,
  ChannelType,
  CommandInteractionOptionResolver,
} from 'discord.js'
import GuildConfiguration from '../src/models/GuildConfiguration'

export const data: CommandData = {
  name: 'setup-prediction',
  description: 'Správa kanálů pro předpovědi.',
  options: [
    {
      name: 'add',
      description: 'Nastav kanál pro používání předpovědí.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel',
          description: 'Kanál, který chceš nastavit pro používání předpovědí.',
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildText],
          required: true,
        },
      ],
    },
    {
      name: 'remove',
      description: 'Odeber kanál pro používání předpovědí skrze ID.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel-id',
          description: 'ID kanálu, který chceš odebrat z používání předpovědí.',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
  ],
  contexts: [0],
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

    if (subcommand === 'add') {
      const channel = interaction.options.getChannel('channel', true)

      guildConfiguration.predictionChannelIds.push(channel.id)

      await guildConfiguration.save()

      return interaction.reply({
        content: `Kanál ${channel} byl úspěšně nastaven pro používání předpovědí.`,
      })
    }

    if (subcommand === 'remove') {
      const channelId = options.getString('channel-id', true)

      if (!guildConfiguration.predictionChannelIds.includes(channelId)) {
        return await interaction.reply(
          `Kanál s ID ${channelId} není nastavený pro předpovědi.`
        )
      }

      guildConfiguration.predictionChannelIds =
        guildConfiguration.predictionChannelIds.filter((id) => id !== channelId)

      await guildConfiguration.save()

      return interaction.reply(
        `Kanál s ID ${channelId} byl úspěšně odebrán z používání předpovědí.`
      )
    }
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
