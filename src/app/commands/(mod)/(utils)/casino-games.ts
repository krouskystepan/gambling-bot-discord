import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  casinoGameGuides,
  formatGameGuideBody
} from '@/utils/casino/gameGuides'
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
  commandName: string,
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

  const usage = required
    ? optional
      ? `- \`/${commandName} ${required}\`\n- \`/${commandName} ${required} ${optional}\``
      : `- \`/${commandName} ${required}\``
    : optional
      ? `- \`/${commandName}\`\n- \`/${commandName} ${optional}\``
      : `- \`/${commandName}\``

  return `**How to use**\n${usage}`
}

const renderSection = (title: string, body: string) => `## ${title}\n${body}`

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const sections = [
      renderSection(
        casinoGameGuides.coinflip.title,
        [
          formatGameGuideBody(casinoGameGuides.coinflip),
          formatCommand('coinflip', [
            { name: 'bet', example: '2000', required: true },
            { name: 'side', example: 'heads', required: true },
            { name: 'flips', example: '10' },
            { name: 'show-balance', example: 'true' },
            { name: 'skip-animations', example: 'true' }
          ])
        ].join('\n\n')
      ),

      renderSection(
        casinoGameGuides.hilo.title,
        [
          formatGameGuideBody(casinoGameGuides.hilo),
          formatCommand('hilo', [{ name: 'show-balance', example: 'true' }])
        ].join('\n\n')
      ),

      renderSection(
        casinoGameGuides.limbo.title,
        [
          formatGameGuideBody(casinoGameGuides.limbo),
          formatCommand('limbo', [
            { name: 'bet', example: '2000', required: true },
            { name: 'target', example: '2', required: true },
            { name: 'rolls', example: '10' },
            { name: 'show-balance', example: 'true' },
            { name: 'skip-animations', example: 'true' }
          ])
        ].join('\n\n')
      ),

      renderSection(
        casinoGameGuides.dice.title,
        [
          formatGameGuideBody(casinoGameGuides.dice),
          formatCommand('dice', [
            { name: 'bet', example: '3000', required: true },
            { name: 'side', example: '2', required: true },
            { name: 'rolls', example: '10' },
            { name: 'show-balance', example: 'true' },
            { name: 'skip-animations', example: 'true' }
          ])
        ].join('\n\n')
      ),

      renderSection(
        casinoGameGuides.goldenJackpot.title,
        [
          formatGameGuideBody(casinoGameGuides.goldenJackpot),
          formatCommand('goldenjackpot', [
            { name: 'bet', example: '2500', required: true },
            { name: 'entries', example: '100' },
            { name: 'show-balance', example: 'true' },
            { name: 'skip-animations', example: 'true' }
          ])
        ].join('\n\n')
      ),

      renderSection(
        casinoGameGuides.lottery.title,
        [
          formatGameGuideBody(casinoGameGuides.lottery),
          formatCommand('lottery', [
            { name: 'bet', example: '1000', required: true },
            { name: 'numbers', example: '5,4,3,10', required: true },
            { name: 'entries', example: '10' },
            { name: 'show-balance', example: 'true' },
            { name: 'skip-animations', example: 'true' }
          ])
        ].join('\n\n')
      ),

      renderSection(
        casinoGameGuides.plinko.title,
        [
          formatGameGuideBody(casinoGameGuides.plinko),
          formatCommand('plinko', [
            { name: 'bet', example: '1000', required: true },
            { name: 'balls', example: '7' },
            { name: 'show-balance', example: 'true' },
            { name: 'skip-animations', example: 'true' }
          ])
        ].join('\n\n')
      ),

      renderSection(
        casinoGameGuides.roulette.title,
        [
          formatGameGuideBody(casinoGameGuides.roulette, [
            '**Bet shortcuts**\n' + getRouletteHelpers()
          ]),
          formatCommand('roulette', [
            { name: 'show-balance', example: 'true' },
            { name: 'skip-animations', example: 'true' }
          ])
        ].join('\n\n')
      ),

      renderSection(
        casinoGameGuides.baccarat.title,
        [
          formatGameGuideBody(casinoGameGuides.baccarat),
          formatCommand('baccarat', [
            { name: 'show-balance', example: 'true' },
            { name: 'skip-animations', example: 'true' }
          ])
        ].join('\n\n')
      ),

      renderSection(
        casinoGameGuides.slots.title,
        [
          formatGameGuideBody(casinoGameGuides.slots),
          formatCommand('slots', [
            { name: 'show-balance', example: 'true' },
            { name: 'skip-animations', example: 'true' }
          ])
        ].join('\n\n')
      ),

      renderSection(
        casinoGameGuides.blackjack.title,
        [
          formatGameGuideBody(casinoGameGuides.blackjack),
          formatCommand('blackjack', [
            { name: 'show-balance', example: 'true' },
            { name: 'skip-animations', example: 'true' }
          ])
        ].join('\n\n')
      ),

      renderSection(
        casinoGameGuides.mines.title,
        [
          formatGameGuideBody(casinoGameGuides.mines),
          formatCommand('mines', [{ name: 'show-balance', example: 'true' }])
        ].join('\n\n')
      ),

      renderSection(
        casinoGameGuides.rps.title,
        [
          formatGameGuideBody(casinoGameGuides.rps),
          formatCommand('rps', [
            { name: 'player', example: '@User', required: true },
            { name: 'bet', example: '1500', required: true }
          ])
        ].join('\n\n')
      )
    ]

    await interaction.reply({
      content:
        '🎮 **Casino Games Guide**\nInstant games settle in one reply. Live tables (Hi-Lo, Blackjack, Baccarat, Mines, Roulette, Slots) keep a session open - see each game for idle rules.'
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
