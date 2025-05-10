import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'
import { ApplicationCommandOptionType } from 'discord.js'
import {
  formatNumberToReadableString,
  formatNumberWithSpaces,
} from '../../../utils/utils'
import {
  DICE_MAX_SIMULATE_ROLLS,
  COINFLIP_MAX_SIMULATE_FLIPS,
  SLOT_MAX_SIMULATE_SPINS,
  LOTTERY_MAX_SIMULATE_ENTRIES,
  GOLDEN_JACKPOT_MAX_SIMULATE_ENTRIES,
} from '../../../utils/defaultConfig'
import GuildConfiguration from '../../../models/GuildConfiguration'

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
  dm_permission: false,
}

export const options: CommandOptions = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  deleted: false,
}

export async function run({ interaction }: SlashCommandProps) {
  const config = await GuildConfiguration.findOne({
    guildId: interaction.guildId,
  })

  const settings = config?.casinoSettings

  if (!settings) return

  const isAdmin = interaction.options.getBoolean('admin') ?? false

  const diceMessage = `## 🎲 Dice
    ${
      isAdmin
        ? `- **Max Simulate Rolls:** ${formatNumberToReadableString(
            DICE_MAX_SIMULATE_ROLLS
          )}`
        : ''
    }
    - **Multiplier:** ${settings.dice.winMultiplier}x
    - **Max Bet:** ${
      settings.dice.maxBet === 0
        ? 'No Limit'
        : formatNumberToReadableString(settings.dice.maxBet)
    }
    - **Min Bet:** ${
      settings.dice.minBet === 0
        ? 'No Limit'
        : formatNumberToReadableString(settings.dice.minBet)
    }`

  const coinFlipMessage = `## 🪙 Coin Flip
    ${
      isAdmin
        ? `- **Max Simulate Flips:** ${formatNumberToReadableString(
            COINFLIP_MAX_SIMULATE_FLIPS
          )}`
        : ''
    }
    - **Multiplier:** ${settings.coinflip.winMultiplier}x
    - **Max Bet:** ${
      settings.coinflip.maxBet === 0
        ? 'No Limit'
        : formatNumberToReadableString(settings.coinflip.maxBet)
    }
    - **Min Bet:** ${
      settings.coinflip.minBet === 0
        ? 'No Limit'
        : formatNumberToReadableString(settings.coinflip.minBet)
    }`

  const slotMessage = `## 🎰 Slots
    ${
      isAdmin
        ? `
- **Max Simulate Spins:** ${formatNumberToReadableString(
            SLOT_MAX_SIMULATE_SPINS
          )}
- **Symbol Weights:** \n${Object.entries(settings.slot.symbolWeights)
            .map(([symbol, weight]) => `  - ${symbol}: ${weight}`)
            .join('\n')}
          `
        : ''
    }
- **Multipliers:** \n${Object.entries(settings.slot.winMultiplier)
    .map(([symbol, multiplier]) => `  - ${symbol}: ${multiplier}x`)
    .join('\n')}
- **Max Bet:** ${
    settings.slot.maxBet === 0
      ? 'No Limit'
      : formatNumberToReadableString(settings.slot.maxBet)
  }
- **Min Bet:** ${
    settings.slot.minBet === 0
      ? 'No Limit'
      : formatNumberToReadableString(settings.slot.minBet)
  }`

  const lotteryMessage = `## 🎟️ Lottery
    ${
      isAdmin
        ? `- **Max Simulate Entries:** ${formatNumberToReadableString(
            LOTTERY_MAX_SIMULATE_ENTRIES
          )}`
        : ''
    }
    - **Multipliers:** \n${Object.entries(settings.lottery.winMultiplier)
      .map(([symbol, multiplier]) => ` - ${symbol}: ${multiplier}x`)
      .join('\n')}
    - **Max Bet:** ${
      settings.lottery.maxBet === 0
        ? 'No Limit'
        : formatNumberToReadableString(settings.lottery.maxBet)
    }
    - **Min Bet:** ${
      settings.lottery.minBet === 0
        ? 'No Limit'
        : formatNumberToReadableString(settings.lottery.minBet)
    }`

  const goldenJackpotMessage = `## 🤑 Golden Jackpot
    ${
      isAdmin
        ? `- **Max Simulate Entries:** ${formatNumberToReadableString(
            GOLDEN_JACKPOT_MAX_SIMULATE_ENTRIES
          )}
- **One in Chance:** 1 in ${formatNumberWithSpaces(
            settings.goldenJackpot.oneInChance
          )}`
        : ''
    }
- **Multiplier:** ${formatNumberWithSpaces(
    settings.goldenJackpot.winMultiplier
  )}x
- **Max Bet:** ${
    settings.goldenJackpot.maxBet === 0
      ? 'No Limit'
      : formatNumberToReadableString(settings.goldenJackpot.maxBet)
  }
- **Min Bet:** ${
    settings.goldenJackpot.minBet === 0
      ? 'No Limit'
      : formatNumberToReadableString(settings.goldenJackpot.minBet)
  }`

  const rpsMessage = `## 🪨📄✂️ RPS
    - **Casino Cut:** ${settings.rps.casinoCut * 100}%
    - **Max Bet:** ${
      settings.rps.maxBet === 0
        ? 'No Limit'
        : formatNumberToReadableString(settings.rps.maxBet)
    }
    - **Min Bet:** ${
      settings.rps.minBet === 0
        ? 'No Limit'
        : formatNumberToReadableString(settings.rps.minBet)
    }`

  const blackjackMessage = `## 🃏 Blackjack
    - **Max Bet:** ${
      settings.blackjack.maxBet === 0
        ? 'No Limit'
        : formatNumberToReadableString(settings.blackjack.maxBet)
    }
    - **Min Bet:** ${
      settings.blackjack.minBet === 0
        ? 'No Limit'
        : formatNumberToReadableString(settings.blackjack.minBet)
    }`

  const games = [
    diceMessage,
    coinFlipMessage,
    slotMessage,
    lotteryMessage,
    goldenJackpotMessage,
    rpsMessage,
    blackjackMessage,
  ]

  return interaction.reply({
    content: `
    # ${isAdmin ? 'Admin' : ''} Casino Information\n${games.join('\n\n')}
    `,
  })
}
