import { MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import { checkUserRegistration } from '@/services'
import {
  formatNumberToReadableString,
  formatNumberWithSpaces
} from '@/utils/common/utils'
import { createSuccessEmbed } from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'balance',
  description: 'Check your current balance (only you can see this).',
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const user = await checkUserRegistration({ interaction })
    if (!user) return

    const roundedBalance = Math.round(user.balance * 100) / 100
    const roundedLockedBalance = Math.round(user.lockedBalance * 100) / 100
    const roundedBonusBalance = Math.round(user.bonusBalance * 100) / 100

    return interaction.reply({
      embeds: [
        createSuccessEmbed(
          'ATM - Balance',
          [
            `💰 Available Balance: **$${formatNumberToReadableString(roundedBalance)}** ($${formatNumberWithSpaces(roundedBalance)})`,
            `🔒 Locked Balance: **$${formatNumberToReadableString(roundedLockedBalance)}** ($${formatNumberWithSpaces(roundedLockedBalance)})`,
            `🎁 Bonus Balance: **$${formatNumberToReadableString(roundedBonusBalance)}** ($${formatNumberWithSpaces(roundedBonusBalance)})`,
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
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
