import { MessageFlags } from 'discord.js'

import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import { checkUserRegistration } from '@/services'
import {
  formatNumberToReadableString,
  formatNumberWithSpaces
} from '@/utils/common/utils'
import { createSuccessEmbed } from '@/utils/discord/createEmbed'

export const data: CommandData = {
  name: 'balance',
  description: 'Check your current balance (only you can see this).',
  dm_permission: false
}

export const options: CommandOptions = {
  deleted: false
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    const user = await checkUserRegistration({ interaction })
    if (!user) return

    const roundedBalance = Math.round(user.balance * 100) / 100
    const roundedLockedBalance = Math.round(user.lockedBalance * 100) / 100

    return interaction.reply({
      embeds: [
        createSuccessEmbed(
          'ATM - Balance',
          `Your balance is **$${formatNumberToReadableString(roundedBalance)}** ($${formatNumberWithSpaces(roundedBalance)}).\nYour locked balance is **$${formatNumberToReadableString(roundedLockedBalance)}** ($${formatNumberWithSpaces(roundedLockedBalance)}).\n`
        )
      ],
      flags: MessageFlags.Ephemeral
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
