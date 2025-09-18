import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import {
  checkUserRegistration,
  formatNumberToReadableString,
  parseReadableStringToNumber,
} from '../../../utils/utils'
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  MessageFlags,
  TextChannel,
} from 'discord.js'
import GuildConfiguration from '../../../models/GuildConfiguration'
import {
  createErrorEmbed,
  createInfoEmbed,
  createSuccessEmbed,
} from '../../../utils/createEmbed'
import User from '../../../models/User'

export const data: CommandData = {
  name: 'withdraw',
  description: 'Withdraw money from your account.',
  options: [
    {
      name: 'amount',
      description: 'The amount you want to withdraw (e.g., 1000, 2k, 10.5k).',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'account',
      description: 'The account you want to send the money to.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  dm_permission: false,
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

    if (!user) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Not registered',
            'You are not registered yet.\nUse the `/register` command to register.'
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

    const account = interaction.options.getString('account', true)
    const amount = interaction.options.getString('amount', true)
    const parsedAmount = parseReadableStringToNumber(amount)
    const readableAmount = formatNumberToReadableString(parsedAmount)

    if (isNaN(parsedAmount)) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Not a number',
            'The value you entered is not a valid number.\nPlease make sure you enter a numerical value.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (parsedAmount <= 0) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Non-positive number',
            'The number you provided must be greater than 0.\nPlease enter a positive value.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const updatedUser = await User.findOneAndUpdate(
      {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        balance: { $gte: parsedAmount },
        $expr: {
          $gte: [{ $subtract: ['$balance', '$lockedBalance'] }, parsedAmount],
        },
      },
      {
        $inc: { balance: -parsedAmount },
      },
      { new: true }
    )

    if (!updatedUser) {
      if (user.balance < parsedAmount) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Insufficient Funds',
              `You don't have enough funds to withdraw **$${readableAmount}**.\nYour current balance is **$${formatNumberToReadableString(
                user.balance
              )}**.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const withdrawable = user.balance - user.lockedBalance

      if (withdrawable < parsedAmount && withdrawable >= 0) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Insufficient Withdrawable Funds',
              `You requested **$${readableAmount}**, but you can only withdraw up to **$${formatNumberToReadableString(
                withdrawable
              )}**.\n` +
                (withdrawable < user.balance
                  ? `**$${formatNumberToReadableString(
                      user.balance - withdrawable
                    )}** of your balance is locked (e.g., bonuses).\n\nYou need to wager those bonuses before you can withdraw them.`
                  : `\n\nYou need to wager any bonuses before you can withdraw them.`)
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }
    }

    const logChannel = client.channels.cache.get(
      guildConfiguration.atmChannelIds.logs
    ) as TextChannel

    const member = interaction.member as GuildMember | null
    const displayName =
      member?.displayName ||
      interaction.user.globalName ||
      interaction.user.username

    const managerRole = guildConfiguration.managerRoleId

    const logMessage = await logChannel.send({
      content: managerRole ? `<@&${managerRole}>` : '',
      embeds: [
        new EmbedBuilder()
          .setTitle(
            `ATM - Withdrawal by ${displayName} (${interaction.user.username})`
          )
          .setColor('Red')
          .setDescription(
            `<@${interaction.user.id}> wants to withdraw **$${readableAmount}** into account **${account}**.`
          ),
      ],
      components: [],
    })

    const approveButton = new ButtonBuilder()
      .setCustomId(
        `atm-withdraw.approve._.${interaction.user.id}-${logMessage.id}.${parsedAmount}`
      )
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success)

    const rejectButton = new ButtonBuilder()
      .setCustomId(
        `atm-withdraw.reject._.${interaction.user.id}-${logMessage.id}.${parsedAmount}`
      )
      .setLabel('Reject')
      .setStyle(ButtonStyle.Danger)

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      approveButton,
      rejectButton
    )

    await logMessage.edit({ components: [row] })

    return interaction.reply({
      embeds: [
        createSuccessEmbed(
          'ATM - Withdraw',
          `You have requested to withdraw **$${readableAmount}**.\nPlease wait for the transaction to be processed.`
        ),
      ],
      flags: MessageFlags.Ephemeral,
    })
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
