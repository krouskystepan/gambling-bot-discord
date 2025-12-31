export type LogLevel = 'BOOT' | 'READY' | 'WORKER' | 'EVENT' | 'ERROR'

const COLORS = {
  reset: '\x1b[0m',

  white: '\x1b[37m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  red: '\x1b[31m'
} as const

const LEVEL_COLOR: Record<LogLevel, string> = {
  BOOT: COLORS.white,
  READY: COLORS.green,
  WORKER: COLORS.cyan,
  EVENT: COLORS.magenta,
  ERROR: COLORS.red
}

const now = (): string =>
  new Date().toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

const colorizeLevel = (level: LogLevel): string =>
  `${LEVEL_COLOR[level]}${level}${COLORS.reset}`

const format = (level: LogLevel, msg: string): string =>
  `[${now()}] [${colorizeLevel(level)}] ${msg}`

export const logger: {
  /**
   * Startup / initialization logs.
   * Use during app bootstrap (DB, listeners, workers).
   */
  boot: (message: string) => void

  /**
   * App is fully ready and online.
   * Use when the bot/service is up and operational.
   */
  ready: (message: string) => void

  /**
   * Background jobs, schedulers, intervals.
   * Use for workers and automated tasks.
   */
  worker: (message: string) => void

  /**
   * User actions or framework events.
   * Use for Discord interactions and important events.
   */
  event: (message: string) => void

  /**
   * Errors and exceptions.
   * Use for caught errors and unexpected failures.
   */
  error: (message: string, error?: unknown) => void
} = {
  boot: (msg) => console.log(format('BOOT', msg)),
  ready: (msg) => console.log(format('READY', msg)),
  worker: (msg) => console.log(format('WORKER', msg)),
  event: (msg) => console.log(format('EVENT', msg)),
  error: (msg, err) => {
    console.error(format('ERROR', msg))
    if (err) console.error(err)
  }
}
