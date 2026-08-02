import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import { getGuildConfigByGuildId } from '@/services'
import {
  casinoGameGuideKeys,
  casinoGameGuides
} from '@/utils/casino/gameGuides'
import { createErrorEmbed, createInfoEmbed } from '@/utils/discord/createEmbed'
import {
  type HelpView,
  isCasinoGameGuideKey,
  resolveHelpPage
} from '@/utils/discord/formatHelpEmbed'

export const command: CommandData = {
  name: 'help',
  description: 'Player guide - commands, games, limits, and how to play.',
  dm_permission: false
}

const HELP_VIEW_TTL_MS = 180_000

const CUSTOM_ID = {
  overview: 'help:tab:overview',
  start: 'help:tab:start',
  commands: 'help:tab:commands',
  games: 'help:tab:games',
  gameSelect: 'help:select:game'
} as const

const tabStyle = (active: boolean) =>
  active ? ButtonStyle.Primary : ButtonStyle.Secondary

const isGamesView = (view: HelpView) =>
  view === 'games' || isCasinoGameGuideKey(view)

const buildComponents = (view: HelpView) => {
  const tabs = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.overview)
      .setLabel('Overview')
      .setStyle(tabStyle(view === 'overview')),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.start)
      .setLabel('Start')
      .setStyle(tabStyle(view === 'start')),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.commands)
      .setLabel('Commands')
      .setStyle(tabStyle(view === 'commands')),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.games)
      .setLabel('Games')
      .setStyle(tabStyle(isGamesView(view)))
  )

  const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [
    tabs
  ]

  if (isGamesView(view)) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(CUSTOM_ID.gameSelect)
          .setPlaceholder('Pick a game…')
          .addOptions(
            casinoGameGuideKeys.map((key) => {
              const option = new StringSelectMenuOptionBuilder()
                .setLabel(casinoGameGuides[key].title)
                .setValue(key)

              if (view === key) {
                option.setDefault(true)
              }

              return option
            })
          )
      )
    )
  }

  return rows
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const guildConfig = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })

    if (!guildConfig?.casinoSettings) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Not Configured',
            'This server is not configured yet. Please contact an administrator.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const settings = guildConfig.casinoSettings
    const globalSettings = guildConfig.globalSettings

    let view: HelpView = 'overview'

    const currentPage = () =>
      resolveHelpPage({ view, settings, globalSettings })

    await interaction.reply({
      embeds: [createInfoEmbed(currentPage().title, currentPage().description)],
      components: buildComponents(view),
      flags: MessageFlags.Ephemeral
    })

    const message = await interaction.fetchReply()

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: HELP_VIEW_TTL_MS
    })

    collector.on('collect', async (component) => {
      try {
        if (component.isButton()) {
          if (component.customId === CUSTOM_ID.overview) view = 'overview'
          else if (component.customId === CUSTOM_ID.start) view = 'start'
          else if (component.customId === CUSTOM_ID.commands) view = 'commands'
          else if (component.customId === CUSTOM_ID.games) view = 'games'
          else {
            await component.deferUpdate()
            return
          }
        } else if (
          component.isStringSelectMenu() &&
          component.customId === CUSTOM_ID.gameSelect
        ) {
          const selected = component.values[0]
          if (!selected || !isCasinoGameGuideKey(selected)) {
            await component.deferUpdate()
            return
          }
          view = selected
        } else {
          await component.deferUpdate()
          return
        }

        const page = currentPage()
        await component.update({
          embeds: [createInfoEmbed(page.title, page.description)],
          components: buildComponents(view)
        })
      } catch {
        collector.stop('error')
      }
    })

    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [] })
      } catch {
        // Message may already be gone.
      }
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
