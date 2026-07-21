import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import { getRouletteHelpers } from '@/utils/casino/roulette'

export const command: CommandData = {
  name: 'casino-games',
  description: 'Show available casino games and how to use them.',
  dm_permission: false
}

export const metadata: CommandMetadata = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator']
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
export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const sections = [
      renderSection(
        '🪙 Coin Flip',
        formatCommand('coinflip', [
          { name: 'bet', example: '2000', required: true },
          { name: 'side', example: 'heads', required: true },
          { name: 'flips', example: '10' },
          { name: 'show-balance', example: 'true' },
          { name: 'skip-animations', example: 'true' }
        ])
      ),

      renderSection(
        '🃏 Hi-Lo',
        formatCommand('hilo', [
          { name: 'bet', example: '2000', required: true },
          { name: 'show-balance', example: 'true' }
        ])
      ),

      renderSection(
        '🎲 Dice',
        formatCommand('dice', [
          { name: 'bet', example: '3000', required: true },
          { name: 'side', example: '2', required: true },
          { name: 'rolls', example: '10' },
          { name: 'show-balance', example: 'true' },
          { name: 'skip-animations', example: 'true' }
        ])
      ),

      renderSection(
        '🤑 Golden Jackpot',
        formatCommand('goldenjackpot', [
          { name: 'bet', example: '2500', required: true },
          { name: 'entries', example: '100' },
          { name: 'show-balance', example: 'true' },
          { name: 'skip-animations', example: 'true' }
        ])
      ),

      renderSection(
        '🎟️ Lottery',
        formatCommand('lottery', [
          { name: 'bet', example: '1000', required: true },
          { name: 'numbers', example: '5,4,3,10', required: true },
          { name: 'entries', example: '10' },
          { name: 'show-balance', example: 'true' },
          { name: 'skip-animations', example: 'true' }
        ])
      ),

      renderSection(
        '🎯 Plinko',
        formatCommand('plinko', [
          { name: 'bet', example: '1000', required: true },
          { name: 'balls', example: '7' },
          { name: 'show-balance', example: 'true' },
          { name: 'skip-animations', example: 'true' }
        ])
      ),

      renderSection(
        '🌀 Roulette',
        [
          formatCommand('roulette', [
            {
              name: 'bets',
              example: '100 red, 50 17, 200 d2, 75 c1, 100 low',
              required: true
            },
            { name: 'spins', example: '5' },
            { name: 'show-balance', example: 'true' },
            { name: 'skip-animations', example: 'true' }
          ]),
          getRouletteHelpers()
        ].join('\n')
      ),

      renderSection(
        '🎰 Slots',
        formatCommand('slots', [
          { name: 'bet', example: '5000', required: true },
          { name: 'spins', example: '10' },
          { name: 'show-balance', example: 'true' },
          { name: 'skip-animations', example: 'true' }
        ])
      ),

      renderSection(
        '🃏 Blackjack',
        formatCommand('blackjack', [
          { name: 'bet', example: '2000', required: true },
          { name: 'show-balance', example: 'true' }
        ])
      ),

      renderSection(
        '🪨📄✂️ RPS',
        formatCommand('rps', [
          { name: 'player', example: '@User', required: true },
          { name: 'bet', example: '1500', required: true }
        ])
      )
    ]

    await interaction.reply({
      content:
        '🎮 **Casino Games**\nAll game instructions are in the thread below.'
    })

    const message = await interaction.fetchReply()

    const thread = await message.startThread({
      name: '🎰 Casino Games Guide',
      autoArchiveDuration: 1440
    })

    for (const section of sections) {
      await thread.send(`${section}\n\u200B`)
    }
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
