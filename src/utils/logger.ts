import pino from 'pino'

export type LogCategory = 'BOOT' | 'READY' | 'WORKER' | 'EVENT' | 'ERROR'

export type LogContext = Record<string, unknown>

const isProduction = process.env.NODE_ENV === 'production'

const defaultLevel = process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug')

const rootLogger = pino({
  level: defaultLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname,category',
            messageFormat: '{category} {msg}'
          }
        }
      })
})

const isLogContext = (value: unknown): value is LogContext =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Error)

const toErrBinding = (value: unknown): LogContext => {
  if (value instanceof Error) return { err: value }
  if (isLogContext(value)) {
    const { error, err, ...rest } = value as LogContext & {
      error?: unknown
      err?: unknown
    }
    const nested = error ?? err
    return nested !== undefined
      ? { ...rest, err: nested }
      : (value as LogContext)
  }
  return { detail: value }
}

const logCategory = (
  category: LogCategory,
  message: string,
  context?: LogContext
): void => {
  rootLogger.info({ category, ...context }, message)
}

const logError = (message: string, bindings: LogContext): void => {
  rootLogger.error({ category: 'ERROR' as const, ...bindings }, message)
}

type LoggerEventFn = {
  (message: string): void
  (context: LogContext, message: string): void
}

type LoggerWorkerFn = {
  (message: string): void
  (context: LogContext, message: string): void
}

type LoggerErrorFn = {
  (message: string): void
  (message: string, err?: unknown): void
  (context: LogContext, message: string): void
}

const eventFn: LoggerEventFn = (arg1: string | LogContext, arg2?: string) => {
  if (typeof arg1 === 'string') {
    logCategory('EVENT', arg1)
    return
  }
  logCategory('EVENT', arg2 ?? '', arg1)
}

const workerFn: LoggerWorkerFn = (arg1: string | LogContext, arg2?: string) => {
  if (typeof arg1 === 'string') {
    logCategory('WORKER', arg1)
    return
  }
  logCategory('WORKER', arg2 ?? '', arg1)
}

const errorFn: LoggerErrorFn = (
  arg1: string | LogContext,
  arg2?: string | unknown
) => {
  if (typeof arg1 === 'string') {
    if (arg2 === undefined) {
      logError(arg1, {})
      return
    }
    if (typeof arg2 === 'string') {
      logError(arg1, { detail: arg2 })
      return
    }
    logError(arg1, toErrBinding(arg2))
    return
  }
  logError(typeof arg2 === 'string' ? arg2 : '', arg1)
}

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
  worker: LoggerWorkerFn

  /**
   * User actions or framework events.
   * Use for Discord interactions and important events.
   */
  event: LoggerEventFn

  /**
   * Errors and exceptions.
   * Use for caught errors and unexpected failures.
   */
  error: LoggerErrorFn
} = {
  boot: (msg) => logCategory('BOOT', msg),
  ready: (msg) => logCategory('READY', msg),
  worker: workerFn,
  event: eventFn,
  error: errorFn
}
