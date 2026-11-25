import { PASSWORD_LOCKED_MESSAGE, ROOM_PASSWORD_LOCKED_MESSAGE } from '@music-together/shared'

/**
 * What to tell somebody whose password was refused. A join the server turned away for too many wrong tries says so
 * (and entering the right password will not help for a while); any other refusal is a plain wrong password.
 */
export function wrongPasswordText(serverMessage: string | undefined): string {
  if (serverMessage === ROOM_PASSWORD_LOCKED_MESSAGE) return ROOM_PASSWORD_LOCKED_MESSAGE
  if (serverMessage === PASSWORD_LOCKED_MESSAGE) return PASSWORD_LOCKED_MESSAGE
  return '密码错误，请重试'
}
