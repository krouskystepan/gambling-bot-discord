import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'
import {
  COINFLIP_MAX_BET,
  COINFLIP_MAX_SIMULATE_FLIPS,
  COINFLIP_WIN_MULTIPLIER,
  DICE_MAX_BET,
  DICE_MAX_SIMULATE_ROLLS,
  DICE_WIN_MULTIPLIER,
  GOLDEN_JACKPOT_MAX_BET,
  GOLDEN_JACKPOT_MAX_SIMULATE_ENTRIES,
  GOLDEN_JACKPOT_MULTIPLIER,
  GOLDEN_JACKPOT_ONE_IN_CHANCE,
  LOTTERY_MAX_BET,
  LOTTERY_MAX_SIMULATE_ENTRIES,
  LOTTERY_MULTIPLIERS,
  RPS_CASINO_CUT,
  SLOT_MAX_BET,
  SLOT_MAX_SIMULATE_SPINS,
  SLOT_MULTIPLIERS,
  SYMBOL_WEIGHTS,
} from '../../../utils/casinoConfig'
import { ApplicationCommandOptionType } from 'discord.js'
import {
  formatNumberToReadableString,
  formatNumberWithSpaces,
} from '../../../utils/utils'

export const data: CommandData = {
  name: 'casino-info',
  description: 'Get information about the casino.',
  options: [
    {
      name: 'admin',
      description:
        'Get information about the casino administrators (contains sensitive information).',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
  ],
  contexts: [0],
}

export const options: CommandOptions = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  deleted: false,
}

export async function run({ interaction }: SlashCommandProps) {
  const isAdmin = interaction.options.getBoolean('admin') ?? false

  const diceMessage = `## 🎲 Dice
    ${
      isAdmin
        ? `- **Max Simulate Rolls:** ${formatNumberToReadableString(
            DICE_MAX_SIMULATE_ROLLS
          )}`
        : ''
    }
    - **Win Multiplier:** ${DICE_WIN_MULTIPLIER}x
    - **Max Bet:** ${
      DICE_MAX_BET === 0
        ? 'No Limit'
        : formatNumberToReadableString(DICE_MAX_BET)
    }`

  const coinFlipMessage = `## 🪙 Coin Flip
    ${
      isAdmin
        ? `- **Max Simulate Flips:** ${formatNumberToReadableString(
            COINFLIP_MAX_SIMULATE_FLIPS
          )}`
        : ''
    }
    - **Win Multiplier:** ${COINFLIP_WIN_MULTIPLIER}x
    - **Max Bet:** ${
      COINFLIP_MAX_BET === 0
        ? 'No Limit'
        : formatNumberToReadableString(COINFLIP_MAX_BET)
    }`

  const slotMessage = `## 🎰 Slots
    ${
      isAdmin
        ? `- **Max Simulate Spins:** ${formatNumberToReadableString(
            SLOT_MAX_SIMULATE_SPINS
          )}
           - **Symbol Weights:** \n${Object.entries(SYMBOL_WEIGHTS)
             .map(([symbol, weight]) => ` - ${symbol}: ${weight}`)
             .join('\n')}
          `
        : ''
    }
    - **Multipliers:** \n${Object.entries(SLOT_MULTIPLIERS)
      .map(([symbol, multiplier]) => ` - ${symbol}: ${multiplier}x`)
      .join('\n')}
    - **Max Bet:** ${
      SLOT_MAX_BET === 0
        ? 'No Limit'
        : formatNumberToReadableString(SLOT_MAX_BET)
    }`

  const lotteryMessage = `## 🎟️ Lottery
    ${
      isAdmin
        ? `- **Max Simulate Entries:** ${formatNumberToReadableString(
            LOTTERY_MAX_SIMULATE_ENTRIES
          )}`
        : ''
    }
    - **Multipliers:** \n${Object.entries(LOTTERY_MULTIPLIERS)
      .map(([symbol, multiplier]) => ` - ${symbol}: ${multiplier}x`)
      .join('\n')}
    - **Max Bet:** ${
      LOTTERY_MAX_BET === 0
        ? 'No Limit'
        : formatNumberToReadableString(LOTTERY_MAX_BET)
    }`

  const rpsMessage = `## 🪨📄✂️ RPS
    - **Casino Cut:** ${RPS_CASINO_CUT * 100}%`

  const goldenJackpotMessage = `## 🤑 Golden Jackpot
    ${
      isAdmin
        ? `- **Max Simulate Entries:** ${formatNumberToReadableString(
            GOLDEN_JACKPOT_MAX_SIMULATE_ENTRIES
          )}
- **One in Chance:** 1 in ${formatNumberWithSpaces(
            GOLDEN_JACKPOT_ONE_IN_CHANCE
          )}`
        : ''
    }
- **Multiplier:** ${formatNumberWithSpaces(GOLDEN_JACKPOT_MULTIPLIER)}x
- **Max Bet:** ${
    GOLDEN_JACKPOT_MAX_BET === 0
      ? 'No Limit'
      : formatNumberToReadableString(GOLDEN_JACKPOT_MAX_BET)
  }`

  const games = [
    diceMessage,
    coinFlipMessage,
    slotMessage,
    lotteryMessage,
    rpsMessage,
    goldenJackpotMessage,
  ]

  return interaction.reply({
    content: `
    # Casino Information\n${games.join('\n\n')}
    `,
  })
}
