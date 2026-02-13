import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
    },
  }),
})

/**
 * Logger wrapper that keeps the same call signature as our previous hand-rolled logger.
 * All existing call sites (10+ files) need zero changes.
 *
 * Signatures:
 *   logger.info(message, context?)
 *   logger.warn(message, context?)
 *   logger.error(message, err?, context?)
 */
export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    baseLogger.info(context ?? {}, message)
  },
  warn(message: string, context?: Record<string, unknown>) {
    baseLogger.warn(context ?? {}, message)
  },
  error(message: string, err?: unknown, context?: Record<string, unknown>) {
    const errObj = err instanceof Error ? err : undefined
    const extra = { ...context, ...(err && !(err instanceof Error) ? { error: String(err) } : {}) }
    baseLogger.error({ ...extra, err: errObj }, message)
  },
}
