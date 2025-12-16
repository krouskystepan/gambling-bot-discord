import { MessageFlags } from 'discord.js'

import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import { checkUserRegistration } from '@/services'
import { createSuccessEmbed } from '@/utils/createEmbed'
import { formatNumberToReadableString } from '@/utils/utils'

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

    return interaction.reply({
      embeds: [
        createSuccessEmbed(
          'ATM - Balance',
          `Your balance is **$${formatNumberToReadableString(user.balance)}** ($${user.balance}).`
        )
      ],
      flags: MessageFlags.Ephemeral
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
