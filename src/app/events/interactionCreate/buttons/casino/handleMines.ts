import {
  cashOutPayout,
  docToMinesEngine,
  revealCell
} from 'gambling-bot-shared/mines'

import { Interaction, MessageFlags } from 'discord.js'

import { handleUnexpectedButtonError } from '@/errors'
import {
  getGuildConfigByGuildId,
  getMinesGameByBetId,
  updateMinesGame
} from '@/services'
import { runWithQuestNotifyInteraction } from '@/services/quests'
import {
  decodeId,
  finishMinesAndSettle,
  renderMinesButtons,
  renderMinesEmbed
} from '@/utils/casino/mines'
import { createErrorEmbed } from '@/utils/discord/createEmbed'

export default async (interaction: Interaction) => {
  if (!interaction.isButton()) return

  return runWithQuestNotifyInteraction(interaction, async () => {
    const data = decodeId(interaction.customId)
    if (!data) return

    const { betId, action, showBalance } = data
    const guildId = interaction.guildId
    if (!guildId) return

    try {
      const guildConfig = await getGuildConfigByGuildId({ guildId })
      const globalSettings = guildConfig?.globalSettings

      const game = await getMinesGameByBetId({ betId, guildId })

      if (!game) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Invalid Game',
              'This game no longer exists.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      if (interaction.user.id !== game.userId) {
        return interaction.reply({
          embeds: [createErrorEmbed('Invalid Input', 'This is not your game.')],
          flags: MessageFlags.Ephemeral
        })
      }

      if (game.status !== 'ACTIVE') {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Game not active',
              'This Mines game is no longer accepting actions.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      await interaction.deferUpdate()

      const engine = docToMinesEngine(game)

      const finishGame = async () => {
        await finishMinesAndSettle({
          game,
          guildConfig,
          guild: interaction.guild,
          sourceChannelId: interaction.channelId,
          showBalance,
          message: interaction.message
        })
      }

      if (action.kind === 'cashout') {
        const cash = cashOutPayout(engine)
        if (cash.kind === 'IGNORED') {
          return interaction.followUp({
            embeds: [
              createErrorEmbed(
                'Cannot Cash Out',
                cash.reason === 'NO_REVEALS'
                  ? 'Reveal at least one safe tile before cashing out.'
                  : 'This game is already finished.'
              )
            ],
            flags: MessageFlags.Ephemeral
          })
        }

        game.status = 'FINISHED'
        game.revealedIndices = engine.revealedIndices
        await updateMinesGame(game)

        await finishGame()
        return
      }

      const reveal = revealCell(engine, action.cellIndex)

      if (reveal.kind === 'IGNORED') {
        return interaction.followUp({
          embeds: [
            createErrorEmbed(
              'Invalid Move',
              reveal.reason === 'ALREADY_REVEALED'
                ? 'That tile is already revealed.'
                : 'That tile cannot be revealed.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      game.revealedIndices = engine.revealedIndices
      game.status = engine.status

      if (reveal.kind === 'MINE') {
        await updateMinesGame(game)
        await finishGame()
        return
      }

      if (reveal.boardCleared) {
        const cash = cashOutPayout(engine)
        game.status = 'FINISHED'
        game.revealedIndices = engine.revealedIndices
        await updateMinesGame(game)
        if (cash.kind === 'OK') {
          await finishGame()
        }
        return
      }

      await updateMinesGame(game)

      await interaction.message.edit({
        embeds: [
          renderMinesEmbed({
            betId,
            betAmount: game.betAmount,
            mineCount: game.mineCount,
            revealedCount: engine.revealedIndices.length,
            multiplier: reveal.multiplier,
            result: { kind: 'SAFE', multiplier: reveal.multiplier },
            showBalance,
            globalSettings
          })
        ],
        components: renderMinesButtons({
          betId,
          state: engine,
          showBalance
        })
      })
    } catch (err) {
      await handleUnexpectedButtonError(interaction, err, {
        handler: 'handleMines'
      })
    }
  })
}
