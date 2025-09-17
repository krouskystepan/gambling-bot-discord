import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'
import { getRouletteHelpers } from '../../../utils/rouletteUtils'

export const data: CommandData = {
  name: 'casino-games',
  description: 'Show available casino games and how to use them.',
  dm_permission: false,
}

export const options: CommandOptions = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  deleted: false,
}

const formatCommand = (
  command: string,
  params: {
    name: string
    example: string
    required?: boolean
  }[]
): string => {
  const required = params
    .filter((p) => p.required)
    .map((p) => `${p.name}:${p.example}`)
    .join(' ')

  const optional = params
    .filter((p) => !p.required)
    .map((p) => `${p.name}:${p.example}`)
    .join(' ')

  let output = `**How to use:**\n`
  output += `- \`/${command} ${required}\``

  if (optional) {
    output += `\n- \`/${command} ${required} ${optional}\``
  }

  return output
}

const renderSection = (title: string, lines: string) => {
  return `## ${title}\n${lines}`
}

export async function run({ interaction }: SlashCommandProps) {
  const games = [
    renderSection(
      '🎲 Dice',
      formatCommand('dice', [
        { name: 'bet', example: '3000', required: true },
        { name: 'side', example: '2', required: true },
        { name: 'rolls', example: '10', required: false },
        { name: 'show-balance', example: 'true', required: false },
        { name: 'skip-animations', example: 'true', required: false },
      ])
    ),

    renderSection(
      '🪙 Coin Flip',
      formatCommand('coinflip', [
        { name: 'bet', example: '2000', required: true },
        { name: 'side', example: 'heads', required: true },
        { name: 'flips', example: '10', required: false },
        { name: 'show-balance', example: 'true', required: false },
        { name: 'skip-animations', example: 'true', required: false },
      ])
    ),

    renderSection(
      '🎰 Slots',
      formatCommand('slots', [
        { name: 'bet', example: '5000', required: true },
        { name: 'spins', example: '10', required: false },
        { name: 'show-balance', example: 'true', required: false },
        { name: 'skip-animations', example: 'true', required: false },
      ])
    ),

    renderSection(
      '🎟️ Lottery',
      formatCommand('lottery', [
        { name: 'bet', example: '1000', required: true },
        { name: 'numbers', example: '5,4,3,10', required: true },
        { name: 'entries', example: '10', required: false },
        { name: 'show-balance', example: 'true', required: false },
        { name: 'skip-animations', example: 'true', required: false },
      ])
    ),

    renderSection(
      '🌀 Roulette',
      [
        formatCommand('roulette', [
          {
            name: 'bets',
            example: '100 red, 50 17, 200 d2, 75 c1, 100 low',
            required: true,
          },
          { name: 'spins', example: '5', required: false },
          { name: 'show-balance', example: 'true', required: false },
          { name: 'skip-animations', example: 'true', required: false },
        ]),
        getRouletteHelpers(),
      ].join('\n')
    ),

    renderSection(
      '🤑 Golden Jackpot',
      formatCommand('goldenjackpot', [
        { name: 'bet', example: '2500', required: true },
        { name: 'entries', example: '100', required: false },
        { name: 'show-balance', example: 'true', required: false },
        { name: 'skip-animations', example: 'true', required: false },
      ])
    ),

    renderSection(
      '🪨📄✂️ RPS',
      formatCommand('rps', [
        { name: 'player', example: '@D4rzk', required: true },
        { name: 'bet', example: '1500', required: true },
      ])
    ),

    renderSection(
      '🃏 Blackjack',
      formatCommand('blackjack', [
        { name: 'bet', example: '2000', required: true },
        { name: 'show-balance', example: 'true', required: false },
      ])
    ),
  ]

  return interaction.reply({
    content: `# 🎮 Casino Games\n${games.join('\n\n')}`,
  })
}
