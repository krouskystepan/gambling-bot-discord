import {
  formatPlinkoBinMultipliersForDisplay,
  isBlackjackPairsEnabled,
  isBlackjackPlusThreeEnabled,
  normalizeBlackjackDeckCount,
  readableGameValueNames
} from 'gambling-bot-shared/casino'
import {
  formatMoney,
  formatNumberWithSpaces,
  getReadableName
} from 'gambling-bot-shared/common'
import {
  type GlobalSettings,
  type TGuildConfiguration
} from 'gambling-bot-shared/guild'

import {
  type CasinoGameGuideKey,
  casinoGameGuideKeys,
  casinoGameGuides
} from '@/utils/casino/gameGuides'

export type HelpView =
  | 'overview'
  | 'start'
  | 'commands'
  | 'games'
  | CasinoGameGuideKey

type CasinoSettings = TGuildConfiguration['casinoSettings']

const betLine = (
  label: string,
  value: number,
  globalSettings?: Partial<GlobalSettings> | null
) =>
  `- **${label}:** ${
    value === 0 ? 'No Limit' : formatMoney(value, globalSettings)
  }`

const formatMultiplierValue = (
  value: number | Record<string, number>,
  label = typeof value === 'number' ? 'Multiplier' : 'Multipliers',
  options?: { omitZero?: boolean }
): string => {
  if (typeof value === 'number') {
    if (options?.omitZero && !(Number.isFinite(value) && value > 0)) {
      return ''
    }
    return `- **${label}:** ${formatNumberWithSpaces(value)}x`
  }

  const entries = Object.entries(value).filter(
    ([, v]) => !options?.omitZero || (Number.isFinite(v) && v > 0)
  )
  if (entries.length === 0) {
    return options?.omitZero ? '' : `- **${label}:**`
  }

  return (
    `- **${label}:**\n` +
    entries
      .map(
        ([k, v]) =>
          `  - **${getReadableName(k, readableGameValueNames)}:** ${formatNumberWithSpaces(v)}x`
      )
      .join('\n')
  )
}

/** Player-safe server limits - no RTP, weights, house edge, or hit rates. */
export const buildPlayerGameSettings = (
  key: CasinoGameGuideKey,
  settings: CasinoSettings,
  globalSettings?: Partial<GlobalSettings> | null
): string[] => {
  switch (key) {
    case 'coinflip':
      return [
        formatMultiplierValue(settings.coinflip.winMultiplier),
        betLine('Min bet', settings.coinflip.minBet, globalSettings),
        betLine('Max bet', settings.coinflip.maxBet, globalSettings)
      ]
    case 'dice':
      return [
        formatMultiplierValue(settings.dice.winMultiplier),
        betLine('Min bet', settings.dice.minBet, globalSettings),
        betLine('Max bet', settings.dice.maxBet, globalSettings)
      ]
    case 'goldenJackpot':
      return [
        formatMultiplierValue(settings.goldenJackpot.winMultiplier),
        betLine('Min bet', settings.goldenJackpot.minBet, globalSettings),
        betLine('Max bet', settings.goldenJackpot.maxBet, globalSettings)
      ]
    case 'lottery':
      return [
        formatMultiplierValue(settings.lottery.winMultipliers),
        betLine('Min bet', settings.lottery.minBet, globalSettings),
        betLine('Max bet', settings.lottery.maxBet, globalSettings)
      ]
    case 'plinko':
      return [
        formatMultiplierValue(
          formatPlinkoBinMultipliersForDisplay(settings.plinko.binMultipliers)
        ),
        betLine('Min bet', settings.plinko.minBet, globalSettings),
        betLine('Max bet', settings.plinko.maxBet, globalSettings)
      ]
    case 'roulette':
      return [
        formatMultiplierValue(settings.roulette.winMultipliers),
        betLine('Min bet', settings.roulette.minBet, globalSettings),
        betLine('Max bet', settings.roulette.maxBet, globalSettings)
      ]
    case 'baccarat': {
      const { winMultipliers, dragonBonusMultipliers, lucky6Multipliers } =
        settings.baccarat
      const fmt = (n: number) => `${formatNumberWithSpaces(n)}x`
      return [
        formatMultiplierValue(winMultipliers),
        `- **Dragon Bonus:** natural ${fmt(dragonBonusMultipliers.naturalWin)} · by 4–9 ${fmt(dragonBonusMultipliers.winBy4)}–${fmt(dragonBonusMultipliers.winBy9)} (natural tie push)`,
        `- **Lucky 6:** 2-card ${fmt(lucky6Multipliers.twoCard)} · 3-card ${fmt(lucky6Multipliers.threeCard)}`,
        betLine('Min bet', settings.baccarat.minBet, globalSettings),
        betLine('Max bet', settings.baccarat.maxBet, globalSettings)
      ]
    }
    case 'slots':
      return [
        formatMultiplierValue(settings.slots.winMultipliers),
        betLine('Min bet', settings.slots.minBet, globalSettings),
        betLine('Max bet', settings.slots.maxBet, globalSettings)
      ]
    case 'blackjack': {
      const { blackjack } = settings
      const decks = normalizeBlackjackDeckCount(blackjack.deckCount)
      return [
        formatMultiplierValue(blackjack.winMultipliers, 'Multipliers', {
          omitZero: true
        }),
        isBlackjackPairsEnabled(blackjack.pairsMultipliers)
          ? formatMultiplierValue(blackjack.pairsMultipliers, 'Perfect Pairs', {
              omitZero: true
            })
          : '',
        isBlackjackPlusThreeEnabled(blackjack.plusThreeMultipliers)
          ? formatMultiplierValue(blackjack.plusThreeMultipliers, '21+3', {
              omitZero: true
            })
          : '',
        `- **Decks:** ${decks} (fresh shoe every hand)`,
        betLine('Min bet', blackjack.minBet, globalSettings),
        betLine('Max bet', blackjack.maxBet, globalSettings)
      ].filter(Boolean)
    }
    case 'hilo':
      return [
        '- **Payout:** Compounds on each correct guess; Cash Out locks in the streak.',
        betLine('Min bet', settings.hilo.minBet, globalSettings),
        betLine('Max bet', settings.hilo.maxBet, globalSettings)
      ]
    case 'limbo':
      return [
        '- **Payout:** Your chosen target multiplier on a win.',
        betLine('Min bet', settings.limbo.minBet, globalSettings),
        betLine('Max bet', settings.limbo.maxBet, globalSettings)
      ]
    case 'mines':
      return [
        '- **Payout:** Rises as you reveal safe tiles.',
        `- **Mines range:** ${settings.mines.minMines}–${settings.mines.maxMines}`,
        betLine('Min bet', settings.mines.minBet, globalSettings),
        betLine('Max bet', settings.mines.maxBet, globalSettings)
      ]
    case 'rps':
      return [
        '- **Payout:** Winner takes the pot.',
        betLine('Min bet', settings.rps.minBet, globalSettings),
        betLine('Max bet', settings.rps.maxBet, globalSettings)
      ]
    case 'prediction':
      return [
        betLine('Min bet', settings.prediction.minBet, globalSettings),
        betLine('Max bet', settings.prediction.maxBet, globalSettings)
      ]
    case 'raffle':
      return ['- Ticket price and prize details are on each raffle message.']
  }
}

export const buildGameHelpDescription = (
  key: CasinoGameGuideKey,
  settings: CasinoSettings,
  globalSettings?: Partial<GlobalSettings> | null
): string => {
  const guide = casinoGameGuides[key]
  const lines: string[] = [`**How it works**\n${guide.how}`]

  if (guide.command) {
    const usage = guide.usage
      ? `\`/${guide.command} ${guide.usage}\``
      : `\`/${guide.command}\``
    lines.push(`**Command**\n${usage}`)
  } else {
    lines.push(
      '**How to join**\nUse the buttons on the staff-posted event message.'
    )
  }

  lines.push(
    '**This server**\n' +
      buildPlayerGameSettings(key, settings, globalSettings).join('\n')
  )

  lines.push(`**If you go idle**\n${guide.idle}`)

  return lines.join('\n\n')
}

export const buildHelpOverview = (): {
  title: string
  description: string
} => ({
  title: 'Help',
  description: [
    'Player guide for this casino bot.',
    '',
    'Use the buttons below:',
    '- **Start** - register, money, daily rewards',
    '- **Commands** - quick list of useful commands',
    '- **Games** - pick a game for how-to, limits, and multipliers',
    '',
    "Server limits (min / max / multipliers) come from this server's settings."
  ].join('\n')
})

export const buildHelpStart = (): { title: string; description: string } => ({
  title: 'Help - Getting Started',
  description: [
    '**1. Register**',
    '`/register` - create your account on this server.',
    '',
    '**2. Move money**',
    '`/deposit request` - request a deposit',
    '`/withdraw request` - request a withdrawal',
    '`/balance` - check available, locked, and bonus balance (private)',
    '`/pay` - send money to another registered player',
    '',
    '**3. Daily stuff**',
    '`/bonus claim` - daily bonus (+ streak)',
    '`/bonus check` - see streak and next reward',
    '`/quests` - daily and normal quest progress',
    '',
    '**4. Play**',
    'Open **Games** for every casino game, or try `/coin-flip`, `/dice`, `/blackjack`, and more.',
    '',
    '**VIP**',
    '`/vip info` - prices and your room',
    '`/vip buy` / `/vip extend` - private room'
  ].join('\n')
})

export const buildHelpCommands = (): {
  title: string
  description: string
} => ({
  title: 'Help - Commands',
  description: [
    '**Account & ATM**',
    '`/register` · `/balance` · `/deposit` · `/withdraw` · `/pay`',
    '',
    '**Rewards**',
    '`/bonus` · `/quests` · `/vip`',
    '',
    '**Instant games** (one reply)',
    '`/coin-flip` · `/dice` · `/limbo` · `/lottery` · `/plinko` · `/goldenjackpot`',
    '',
    '**Live tables** (session stays open)',
    '`/hilo` · `/roulette` · `/baccarat` · `/slots` · `/blackjack` · `/mines` · `/rps`',
    '',
    '**Events** (staff posts a message)',
    'Predictions and raffles - use the buttons on those messages.',
    '',
    'Tip: open **Games** and pick a game for limits and multipliers on this server.'
  ].join('\n')
})

export const buildHelpGamesIndex = (): {
  title: string
  description: string
} => ({
  title: 'Help - Games',
  description: [
    'Pick a game from the menu below.',
    '',
    "Each page covers how to play, the slash command, this server's min / max / multipliers, and idle rules for live tables.",
    '',
    casinoGameGuideKeys
      .map((key) => `- ${casinoGameGuides[key].title}`)
      .join('\n')
  ].join('\n')
})

export const resolveHelpPage = ({
  view,
  settings,
  globalSettings
}: {
  view: HelpView
  settings: CasinoSettings
  globalSettings?: Partial<GlobalSettings> | null
}): { title: string; description: string } => {
  if (view === 'overview') return buildHelpOverview()
  if (view === 'start') return buildHelpStart()
  if (view === 'commands') return buildHelpCommands()
  if (view === 'games') return buildHelpGamesIndex()

  const guide = casinoGameGuides[view]
  return {
    title: `Help - ${guide.title}`,
    description: buildGameHelpDescription(view, settings, globalSettings)
  }
}

export const isCasinoGameGuideKey = (
  value: string
): value is CasinoGameGuideKey => value in casinoGameGuides
