import {
  formatMoney,
  generateId,
  parseReadableStringToNumber
} from 'gambling-bot-shared/common'
import { isValidMineCount } from 'gambling-bot-shared/mines'

import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  checkCasinoChannels,
  checkUserRegistration,
  getMinesGameByUserAndGuild,
  getUser
} from '@/services'
import { runWithQuestNotifyInteraction } from '@/services/quests'
import { startMinesBoard } from '@/utils/casino/mines'
import { checkValidBet } from '@/utils/common/utils'
import { createErrorEmbed } from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'mines',
  description: 'Play Mines. Reveal safe tiles, then cash out.',
  options: [
    {
      name: 'bet',
      description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
      type: ApplicationCommandOptionType.String,
      required: true
    },
    {
      name: 'mines',
      description: 'Number of mines on the board.',
      type: ApplicationCommandOptionType.Integer,
      required: true,
      min_value: 1,
      max_value: 19
    },
    {
      name: 'show-balance',
      description:
        'Displays the current balance (WARNING: VISIBLE TO EVERYONE)!',
      type: ApplicationCommandOptionType.Boolean,
      required: false
    }
  ],
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  return runWithQuestNotifyInteraction(interaction, async () => {
    try {
      const user = await checkUserRegistration({ interaction })
      if (!user) return

      const configReply = await checkCasinoChannels(interaction)
      if (!configReply) return

      const existingGame = await getMinesGameByUserAndGuild({
        userId: interaction.user.id,
        guildId: interaction.guildId!
      })

      if (existingGame) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Mines Already Active',
              'You already have an active Mines game running! 💣'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const betAmount = interaction.options.getString('bet', true)
      const mineCount = interaction.options.getInteger('mines', true)
      const parsedBetAmount = parseReadableStringToNumber(betAmount)
      const showBalance =
        interaction.options.getBoolean('show-balance') || false

      const minesSettings = configReply.casinoSettings.mines

      if (
        !isValidMineCount(
          mineCount,
          minesSettings.minMines,
          minesSettings.maxMines
        )
      ) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Invalid Mines Count',
              `Choose between **${minesSettings.minMines}** and **${minesSettings.maxMines}** mines.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const isBetValid = checkValidBet(
        interaction,
        parsedBetAmount,
        minesSettings.maxBet,
        minesSettings.minBet,
        configReply.globalSettings
      )

      if (!isBetValid) return

      await interaction.deferReply()

      const message = await interaction.fetchReply()

      try {
        const board = await startMinesBoard({
          userId: user.userId,
          guildId: user.guildId,
          gameId: generateId('mines'),
          channelId: interaction.channelId,
          messageId: message.id,
          betAmount: parsedBetAmount,
          mineCount,
          houseEdge: minesSettings.houseEdge,
          showBalance,
          globalSettings: configReply.globalSettings
        })

        await interaction.editReply({
          embeds: board.embeds,
          components: board.components
        })
      } catch (err) {
        if (err instanceof Error && err.message === 'INSUFFICIENT_FUNDS') {
          const freshUser = await getUser({
            userId: user.userId,
            guildId: user.guildId
          })

          return await interaction.editReply({
            embeds: [
              createErrorEmbed(
                'Error - Insufficient Funds',
                `You don't have enough money to place this bet.\nYour current balance is **${formatMoney(freshUser?.balance ?? 0, configReply.globalSettings)}**.`
              )
            ]
          })
        }
        throw err
      }
    } catch (error) {
      await handleUnexpectedInteractionError(interaction, error)
    }
  })
}
