import { EVENTS } from '@music-together/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  checkAuthRateLimit: vi.fn(async () => true),
  listUserPlaylists: vi.fn(),
  getUserCookie: vi.fn(() => 'MUSIC_U=secret' as string | null),
  mapping: { roomId: 'ROOM01', userId: 'user-1' } as { roomId: string; userId: string } | undefined,
}))

vi.mock('../middleware/socketRateLimiter.js', () => ({ checkAuthRateLimit: mocks.checkAuthRateLimit }))
vi.mock('../repositories/roomRepository.js', () => ({ roomRepo: { getSocketMapping: () => mocks.mapping } }))
vi.mock('../services/authService.js', () => ({ getUserCookie: mocks.getUserCookie }))
vi.mock('../services/authProvider.js', () => ({ listUserPlaylists: mocks.listUserPlaylists }))
vi.mock('../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { registerPlaylistController } from './playlistController.js'

function setup() {
  let handler!: (data: unknown) => Promise<void>
  const emitted: Array<[string, unknown]> = []
  const socket = {
    id: 'socket-1',
    on: (_event: string, fn: typeof handler) => {
      handler = fn
    },
    emit: (event: string, payload: unknown) => emitted.push([event, payload]),
  }
  registerPlaylistController({} as never, socket as never)
  const answers = () => emitted.filter(([name]) => name === EVENTS.PLAYLIST_MY_LIST).map(([, payload]) => payload)
  return { send: handler, answers }
}

beforeEach(() => {
  mocks.mapping = { roomId: 'ROOM01', userId: 'user-1' }
  mocks.checkAuthRateLimit.mockResolvedValue(true)
  mocks.getUserCookie.mockReturnValue('MUSIC_U=secret')
  mocks.listUserPlaylists.mockResolvedValue([{ id: '1', name: 'Liked' }])
})

describe('PLAYLIST_GET_MY', () => {
  it('asks the platform with the cookie while within the account-event budget', async () => {
    const { send, answers } = setup()
    await send({ platform: 'netease' })
    expect(mocks.checkAuthRateLimit).toHaveBeenCalledOnce()
    expect(mocks.listUserPlaylists).toHaveBeenCalledExactlyOnceWith('netease', 'MUSIC_U=secret')
    expect(answers()).toEqual([{ platform: 'netease', playlists: [{ id: '1', name: 'Liked' }] }])
  })

  it('does not go upstream once the budget is spent, and still answers so the client never hangs', async () => {
    mocks.checkAuthRateLimit.mockResolvedValue(false)
    const { send, answers } = setup()
    await send({ platform: 'kugou' })
    expect(mocks.listUserPlaylists).not.toHaveBeenCalled()
    expect(answers()).toEqual([{ platform: 'kugou', playlists: [] }])
  })

  it.each([
    ['not in a room', () => (mocks.mapping = undefined)],
    ['without a cookie for the platform', () => mocks.getUserCookie.mockReturnValue(null)],
  ])('answers with nothing, and spends no budget, when the user is %s', async (_name, arrange) => {
    arrange()
    const { send, answers } = setup()
    await send({ platform: 'tencent' })
    expect(mocks.listUserPlaylists).not.toHaveBeenCalled()
    expect(mocks.checkAuthRateLimit).not.toHaveBeenCalled()
    expect(answers()).toEqual([{ platform: 'tencent', playlists: [] }])
  })
})
