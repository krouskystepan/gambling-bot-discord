import { previewWithdrawBalance } from 'gambling-bot-shared/atm'
import {
  formatMoney,
  formatMoneyExact,
  parseReadableStringToNumber
} from 'gambling-bot-shared/common'

import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  addUserBonus,
  assertManagerOrAdmin,
  checkAtmChannels,
  checkTargetUserRegistration,
  createTransaction,
  deleteAllTransactionsByUserId,
  resetUserBalance,
  updateUserBalanceAtomic
} from '@/services'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export const command: CommandData = {
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
          required: true
        },
        {
          name: 'amount',
          description:
            'The amount you want to add. (You can also enter 1000, 2.5k, 2M).',
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
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
          required: true
        },
        {
          name: 'amount',
          description:
            'The amount you want to remove. (You can also enter 5k, 2.5k, 2M).',
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
    },
    {
      name: 'add-bonus',
      description: 'Give a bonus to a user.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user you want to give a bonus to.',
          type: ApplicationCommandOptionType.User,
          required: true
        },
        {
          name: 'amount',
          description:
            'The bonus amount to give. (You can also enter 1000, 2.5k, 2M).',
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
    },
    {
      name: 'remove-bonus',
      description: 'Remove bonus funds from a user.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user whose bonus you want to remove.',
          type: ApplicationCommandOptionType.User,
          required: true
        },
        {
          name: 'amount',
          description:
            'The amount of bonus to remove. (You can also enter 1000, 2.5k, 2M).',
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
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
          required: true
        }
      ]
    },
    {
      name: 'reset',
      description:
        'Reset a user’s balance to zero and remove all their transactions in this server.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description:
            'The user whose balance and transaction history you want to reset.',
          type: ApplicationCommandOptionType.User,
          required: true
        }
      ]
    }
  ],
  dm_permission: false
}

export const metadata: CommandMetadata = {
  botPermissions: ['Administrator']
}
export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const configReply = await checkAtmChannels(interaction)
    if (!configReply) return

    const access = await assertManagerOrAdmin(interaction, configReply)
    if (!access.ok) return

    const options = interaction.options
    const subcommand = options.getSubcommand()
    const user = options.getUser('user', true)

    if (user.bot) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Invalid Input - Bot user',
            'This command cannot target a bot.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const amountStr = options.getString('amount', false)
    const parsedAmount = amountStr ? parseReadableStringToNumber(amountStr) : 0

    const targetUser = await checkTargetUserRegistration({
      interaction,
      targetUserId: user.id
    })
    if (!targetUser) return

    if (subcommand === 'deposit') {
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return interaction.reply({
          embeds: [
            createErrorEmbed('Invalid Input', 'Enter a positive number.')
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const updatedUser = await updateUserBalanceAtomic({
        userId: user.id,
        guildId: interaction.guildId!,
        balanceDelta: parsedAmount
      })
      if (!updatedUser) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Balance Update Failed',
              'Could not update balance.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      await createTransaction({
        userId: user.id,
        guildId: interaction.guildId!,
        amount: parsedAmount,
        type: 'deposit',
        source: 'command',
        handledBy: interaction.user.id
      })

      logger.event(
        {
          action: 'balance_deposit',
          actorId: interaction.user.id,
          targetUserId: user.id,
          amount: parsedAmount,
          guildId: interaction.guildId
        },
        'Admin balance deposit'
      )

      return interaction.reply({
        content: `<@${user.id}>`,
        embeds: [
          createSuccessEmbed(
            'ATM - Admin Deposit',
            `An administrator has added **${formatMoney(parsedAmount, configReply.globalSettings)}** to <@${user.id}>'s balance.\n` +
              `**New Balance:** ${formatMoney(updatedUser!.balance, configReply.globalSettings)}`
          )
        ]
      })
    }

    if (subcommand === 'withdraw') {
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return interaction.reply({
          embeds: [
            createErrorEmbed('Invalid Input', 'Enter a positive number.')
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const preview = previewWithdrawBalance(
        targetUser.balance,
        targetUser.lockedBalance,
        parsedAmount
      )

      if (!preview.ok) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Insufficient Withdrawable Funds',
              `You cannot withdraw **${formatMoney(parsedAmount, configReply.globalSettings)}** because **${formatMoney(
                targetUser.lockedBalance,
                configReply.globalSettings
              )}** of the balance comes from bonuses.\n\nThey must wager the bonuses first.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const updatedUser = await updateUserBalanceAtomic({
        userId: user.id,
        guildId: interaction.guildId!,
        balanceDelta: -parsedAmount,
        requireAvailableGte: parsedAmount
      })

      if (!updatedUser) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Insufficient Withdrawable Funds',
              `User does not have **${formatMoney(parsedAmount, configReply.globalSettings)}** available to withdraw.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      await createTransaction({
        userId: user.id,
        guildId: interaction.guildId!,
        amount: parsedAmount,
        type: 'withdraw',
        source: 'command',
        handledBy: interaction.user.id
      })

      logger.event(
        {
          action: 'balance_withdraw',
          actorId: interaction.user.id,
          targetUserId: user.id,
          amount: parsedAmount,
          guildId: interaction.guildId
        },
        'Admin balance withdraw'
      )

      return interaction.reply({
        content: `<@${user.id}>`,
        embeds: [
          createSuccessEmbed(
            'ATM - Admin Withdraw',
            `An administrator has removed **${formatMoney(parsedAmount, configReply.globalSettings)}** from <@${user.id}>'s balance.\n` +
              `**New Balance:** ${formatMoney(updatedUser!.balance, configReply.globalSettings)}`
          )
        ]
      })
    }

    if (subcommand === 'reset') {
      await resetUserBalance({
        userId: user.id,
        guildId: interaction.guildId!
      })

      await deleteAllTransactionsByUserId({
        userId: user.id,
        guildId: interaction.guildId!
      })

      logger.event(
        {
          action: 'balance_reset',
          actorId: interaction.user.id,
          targetUserId: user.id,
          guildId: interaction.guildId
        },
        'Admin balance reset'
      )

      return interaction.reply({
        content: `<@${user.id}>`,
        embeds: [
          createSuccessEmbed(
            'ATM - Admin Reset',
            `An administrator has reset <@${user.id}>'s balance and cleared transaction history.\n` +
              `**New Balance:** ${formatMoney(0, configReply.globalSettings)}`
          )
        ]
      })
    }

    if (subcommand === 'add-bonus') {
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return interaction.reply({
          embeds: [
            createErrorEmbed('Invalid Input', 'Enter a positive number.')
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const updatedUser = await addUserBonus({
        userId: user.id,
        guildId: interaction.guildId!,
        amount: parsedAmount
      })

      if (!updatedUser) {
        return interaction.reply({
          embeds: [createErrorEmbed('Bonus Failed', 'Could not apply bonus.')],
          flags: MessageFlags.Ephemeral
        })
      }

      await createTransaction({
        userId: user.id,
        guildId: interaction.guildId!,
        amount: parsedAmount,
        type: 'bonus',
        source: 'command',
        handledBy: interaction.user.id
      })

      logger.event(
        {
          action: 'balance_bonus',
          actorId: interaction.user.id,
          targetUserId: user.id,
          amount: parsedAmount,
          guildId: interaction.guildId
        },
        'Admin bonus granted'
      )

      return interaction.reply({
        content: `<@${user.id}>`,
        embeds: [
          createSuccessEmbed(
            'ATM - Bonus Given',
            `Granted **${formatMoney(parsedAmount, configReply.globalSettings)}** bonus to <@${user.id}>.\n` +
              `Bonus balance: **${formatMoney(
                updatedUser.bonusBalance ?? 0,
                configReply.globalSettings
              )}**`
          )
        ]
      })
    }

    if (subcommand === 'check') {
      const roundedBalance = Math.floor(targetUser.balance)
      const roundedLockedBalance = Math.floor(targetUser.lockedBalance)
      const roundedBonusBalance = Math.floor(targetUser.bonusBalance)

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'ATM - Balance',
            [
              `💰 Available Balance: **${formatMoney(roundedBalance, configReply.globalSettings)}** (${formatMoneyExact(roundedBalance, configReply.globalSettings)})`,
              `🔒 Locked Balance: **${formatMoney(roundedLockedBalance, configReply.globalSettings)}** (${formatMoneyExact(roundedLockedBalance, configReply.globalSettings)})`,
              `🎁 Bonus Balance: **${formatMoney(roundedBonusBalance, configReply.globalSettings)}** (${formatMoneyExact(roundedBonusBalance, configReply.globalSettings)})`,
              '',
              '**What this means:**',
              '- **Available Balance** - money you can freely bet and withdraw.',
              '- **Locked Balance** - money currently tied to active bets or games.',
              '- **Bonus Balance** - promotional funds that must be wagered before withdrawal.'
            ].join('\n')
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
