import { ColorResolvable, EmbedBuilder } from 'discord.js'

export const createBetEmbed = (
  title: string,
  color: ColorResolvable,
  description: string
) => {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(description)
    .setTimestamp()
}

export const createSuccessEmbed = (title: string, description: string) => {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor('Green')
    .setDescription(description)
}

export const createErrorEmbed = (title: string, description: string) => {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor('Red')
    .setDescription(description)
}

export const createInfoEmbed = (title: string, description: string) => {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor('Blue')
    .setDescription(description)
}
