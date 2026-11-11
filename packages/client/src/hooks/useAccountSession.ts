import { useAuth } from '@/hooks/useAuth'
import { getMyPlatformStatus, getPlatformStatus } from '@/lib/platform'
import { storage } from '@/lib/storage'
import type { MusicSource } from '@music-together/shared'
import { useCallback, useMemo, useState } from 'react'

/**
 * What the account dialog shares between its header (platform + avatar menu) and its body (playlists, recommendations):
 * the platform being looked at, who is signed in on it, and the login flows (QR code, pasted cookie).
 */
export function useAccountSession() {
  const auth = useAuth()
  const { setCookie, requestQrCode, resetQr } = auth
  const [platform, setPlatform] = useState<MusicSource>('netease')
  const [qrOpen, setQrOpen] = useState(false)
  const [cookieOpen, setCookieOpen] = useState(false)

  const myStatus = getMyPlatformStatus(platform, auth.myStatus)
  const roomStatus = getPlatformStatus(platform, auth.platformStatus)
  const loggedIn = myStatus?.loggedIn ?? false
  // "Verifying…" only while the first AUTH_MY_STATUS answer is pending; afterwards the server's word is final.
  const verifying = useMemo(() => !auth.statusLoaded && storage.hasAuthCookie(platform), [auth.statusLoaded, platform])

  const startQrLogin = useCallback(() => {
    requestQrCode(platform)
    setQrOpen(true)
  }, [requestQrCode, platform])

  const changeQrOpen = useCallback(
    (open: boolean) => {
      setQrOpen(open)
      if (!open) resetQr()
    },
    [resetQr],
  )

  const submitCookie = useCallback(
    (cookie: string) => {
      setCookie(platform, cookie)
      setCookieOpen(false)
    },
    [setCookie, platform],
  )

  const logout = useCallback(() => auth.logout(platform), [auth, platform])

  return {
    auth,
    platform,
    setPlatform,
    myStatus,
    roomStatus,
    loggedIn,
    verifying,
    qrOpen,
    changeQrOpen,
    cookieOpen,
    setCookieOpen,
    startQrLogin,
    submitCookie,
    logout,
  }
}

export type AccountSession = ReturnType<typeof useAccountSession>
