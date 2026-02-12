export function log(message: string, ...args: unknown[]) {
  console.log(`[${new Date().toISOString()}] ${message}`, ...args)
}

export function logError(message: string, ...args: unknown[]) {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`, ...args)
}
