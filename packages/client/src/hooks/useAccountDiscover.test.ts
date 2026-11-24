// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import type { RoomState } from '@music-together/shared'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { appQueryClient, clearAppQueryCache, queryKeys } from '@/lib/queryClient'
import { useRoomStore } from '@/stores/roomStore'
import { useAccountDiscover } from './useAccountDiscover'

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/metadataFetch', () => ({ metadataFetch: fetchMock }))
vi.mock('@/lib/config', () => ({ SERVER_URL: 'https://music.test' }))

beforeEach(() => {
  clearAppQueryCache()
  useRoomStore.setState({ room: { id: 'ROOM01' } as RoomState })
  fetchMock.mockReset()
})

afterEach(() => {
  cleanup()
  useRoomStore.getState().reset()
})

it('reuses discovery on reopen until the confirmed login changes', async () => {
  let name = 'signed out'
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    json: async () => url.includes('/home') ? { playlists: [{ name }], artists: [], albums: [], failed: [] } : { items: [] },
  }))

  const renderAccount = (loggedIn: boolean) => renderHook(() => useAccountDiscover('netease', loggedIn, false))
  const signedOut = renderAccount(false)
  await waitFor(() => expect(signedOut.result.current.playlists.items[0]?.name).toBe('signed out'))
  signedOut.unmount()

  const reopened = renderAccount(false)
  await waitFor(() => expect(reopened.result.current.playlists.items[0]?.name).toBe('signed out'))
  expect(fetchMock).toHaveBeenCalledTimes(2)
  reopened.unmount()

  const mine = queryKeys.playlist.mine('netease', 'ROOM01', '1', 0, 50)
  appQueryClient.setQueryData(mine, ['previous account'])
  name = 'signed in'
  const signedIn = renderAccount(true)
  await waitFor(() => expect(signedIn.result.current.playlists.items[0]?.name).toBe('signed in'))
  expect(appQueryClient.getQueryData(mine)).toBeUndefined()
  // Radar is still fresh. Home and daily used the new login.
  expect(fetchMock).toHaveBeenCalledTimes(4)
})
