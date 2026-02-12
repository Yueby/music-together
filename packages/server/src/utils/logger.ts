type LogLevel = 'info' | 'warn' | 'error'

interface LogContext {
  roomId?: string
  socketId?: string
  event?: string
  [key: string]: unknown
}

function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const ts = new Date().toISOString()
  const ctx = context ? ` ${JSON.stringify(context)}` : ''
  return `[${ts}] ${level.toUpperCase()} ${message}${ctx}`
}

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(formatLog('info', message, context))
  },
  warn(message: string, context?: LogContext) {
    console.warn(formatLog('warn', message, context))
  },
  error(message: string, err?: unknown, context?: LogContext) {
    const errMsg = err instanceof Error ? err.message : String(err ?? '')
    const errCtx = err instanceof Error ? { ...context, error: errMsg, stack: err.stack } : { ...context, error: errMsg }
    console.error(formatLog('error', message, errCtx))
  },
}

/** @deprecated Use logger.info / logger.error instead */
export function log(message: string, ...args: unknown[]) {
  console.log(`[${new Date().toISOString()}] ${message}`, ...args)
}

/** @deprecated Use logger.error instead */
export function logError(message: string, ...args: unknown[]) {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`, ...args)
}
