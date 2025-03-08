import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import User from '../../../models/User'
import {
  checkChannelConfiguration,
  formatNumberToReadableString,
  parseReadableStringToNumber,
} from '../../../utils/utils'
import {
  ApplicationCommandOptionType,
  CommandInteractionOptionResolver,
  MessageFlags,
} from 'discord.js'
import {
  createErrorEmbed,
  createInfoEmbed,
  createSuccessEmbed,
} from '../../../utils/createEmbed'

export const data: CommandData = {
  name: 'manage-balance',
  description: 'Manage user balances.',
  options: [
    {
      name: 'deposit',
      description: 'Add money to a user.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user to whom you want to add money.',
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: 'amount',
          description:
            'The amount you want to add. (You can also enter 1000, 2.5k, 2M).',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: 'withdraw',
      description: 'Remove money from a user.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user from whom you want to remove money.',
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: 'amount',
          description:
            'The amount you want to remove. (You can also enter 5k, 2.5k, 2M).',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: 'check',
      description: 'Check a user’s balance.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user whose balance you want to check.',
          type: ApplicationCommandOptionType.User,
          required: true,
        },
      ],
    },
    {
      name: 'list',
      description: 'Check the balance of all users.',
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: 'reset',
      description: 'Reset a user’s balance.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user whose balance you want to reset.',
          type: ApplicationCommandOptionType.User,
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

export async function run({ interaction, client }: SlashCommandProps) {
  try {
    const configReply = await checkChannelConfiguration(
      interaction,
      'adminChannelIds',
      {
        notSet:
          'This server has not been configured for admin commands yet. Set it up using `/setup-manage`.',
        notAllowed: `This channel is not configured for admin commands. Try one of these channels:`,
      }
    )

    if (configReply) return

    const options = interaction.options as CommandInteractionOptionResolver

    const subcommand = options.getSubcommand()

    if (subcommand === 'deposit') {
      const user = interaction.options.getUser('user', true)

      if (user.bot) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Invalid Input - Bot user',
              'You cannot deposit money to a bot.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const amount = interaction.options.getString('amount', true).toUpperCase()
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

      const userDocument = await User.findOne({
        userId: user.id,
        guildId: interaction.guildId,
      })
      if (!userDocument) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Not registered',
              'This user has not registered yet.\nThey should use `/register` or you can force register them with `/force-register`.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      userDocument.balance += parsedAmount
      await userDocument.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'ATM - Admin Deposit',
            `You have successfully added **$${readableAmount}** to <@${
              user.id
            }>.\nTheir new balance is now: **$${formatNumberToReadableString(
              userDocument.balance
            )}**.`
          ),
        ],
      })
    }

    if (subcommand === 'withdraw') {
      const user = interaction.options.getUser('user', true)

      if (user.bot) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Invalid Input - Bot user',
              'You cannot withdraw money from a bot.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const amount = interaction.options.getString('amount', true).toUpperCase()
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

      const userDocument = await User.findOne({
        userId: user.id,
        guildId: interaction.guildId,
      })

      if (!userDocument) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Not registered',
              'This user has not registered yet.\nThey should use `/register` or you can force register them with `/force-register`.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      if (userDocument.balance < parsedAmount) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Insufficient Funds',
              `User <@${
                userDocument.id
              }> does not have enough balance.\nCurrent balance: $${formatNumberToReadableString(
                userDocument.balance
              )}.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      userDocument.balance -= parsedAmount
      await userDocument.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'ATM - Admin Withdraw',
            `You have successfully removed **$${readableAmount}** from <@${
              user.id
            }>.\nTheir new balance is now: **$${formatNumberToReadableString(
              userDocument.balance
            )}**.`
          ),
        ],
      })
    }

    if (subcommand === 'reset') {
      const user = interaction.options.getUser('user', true)

      if (user.bot) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Invalid Input - Bot user',
              'You cannot reset the balance of a bot.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const userDocument = await User.findOne({
        userId: user.id,
        guildId: interaction.guildId,
      })

      if (!userDocument) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Not registered',
              'This user has not registered yet.\nThey should use `/register` or you can force register them with `/force-register`.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      userDocument.balance = 0

      await userDocument.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'ATM - Admin Reset',
            `You have successfully reset the balance of <@${
              user.id
            }>.\nTheir new balance is now: **$${formatNumberToReadableString(
              userDocument.balance
            )}**.`
          ),
        ],
      })
    }

    if (subcommand === 'check') {
      const user = interaction.options.getUser('user', true)

      if (user.bot) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Invalid Input - Bot user',
              'You cannot check the balance of a bot.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      const userDocument = await User.findOne({
        userId: user.id,
        guildId: interaction.guildId,
      })

      if (!userDocument) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Not registered',
              'This user has not registered yet.\nThey should use `/register` or you can force register them with `/force-register`.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'ATM - Admin Check',
            `The balance of <@${user.id}> is **$${formatNumberToReadableString(
              userDocument.balance
            )}**.`
          ),
        ],
      })
    }

    if (subcommand === 'list') {
      const users = await User.find({ guildId: interaction.guildId })

      if (!users.length) {
        return interaction.reply({
          embeds: [
            createInfoEmbed('No users found', 'No users have registered yet.'),
          ],
        })
      }

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'ATM - User Balances',
            users
              .sort((a, b) => b.balance - a.balance)
              .map(
                (user) =>
                  `<@${user.userId}>: **$${formatNumberToReadableString(
                    user.balance
                  )}**.`
              )
              .join('\n')
          ),
        ],
      })
    }
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
