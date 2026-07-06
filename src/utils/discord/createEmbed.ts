import { ColorResolvable, EmbedBuilder } from 'discord.js'

export const createBetEmbed = (
  title: string,
  color: ColorResolvable,
  description: string,
  id?: string
) => {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(description)

  if (id) {
    embed.setFooter({ text: `ID: ${id}` })
  }

  return embed
}

/** Action completed as intended (setup saved, bet placed, mod action done). */
export const createSuccessEmbed = (
  title: string,
  description: string,
  id?: string
) => {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor('Green')
    .setDescription(description)

  if (id) {
    embed.setFooter({ text: `ID: ${id}` })
  }

  return embed
}

/** Action blocked or failed (invalid input, insufficient funds, permission denied). */
export const createErrorEmbed = (title: string, description: string) => {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor('Red')
    .setDescription(description)
}

/** Attention needed or soft failure (expiry reminders, idle nudges, eligibility limits). */
export const createWarningEmbed = (
  title: string,
  description: string,
  id?: string
) => {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor('Yellow')
    .setDescription(description)

  if (id) {
    embed.setFooter({ text: `ID: ${id}` })
  }

  return embed
}

/** Neutral, non-alarming context (read-only queries, empty states, closed events). */
export const createInfoEmbed = (title: string, description: string) => {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor('Blue')
    .setDescription(description)
}
