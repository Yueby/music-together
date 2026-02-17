import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import { usePlaylist } from '@/hooks/usePlaylist'
import { PLATFORM_SHORT_LABELS, PLATFORM_COLORS, getPlatformStatus, getMyPlatformStatus } from '@/lib/platform'
import { storage } from '@/lib/storage'
import type { MusicSource, Playlist } from '@music-together/shared'
import { useState, useCallback, useMemo } from 'react'
import { LoginSection } from './LoginSection'
import { ManualCookieDialog } from './ManualCookieDialog'
import { QrLoginDialog } from './QrLoginDialog'
import { PlaylistDetail } from './PlaylistDetail'
import { PlaylistSection } from './PlaylistSection'

type ViewState =
  | { type: 'list' }
  | { type: 'detail'; playlist: Playlist; source: MusicSource }

export function PlatformHub() {
  const auth = useAuth()
  const playlist = usePlaylist()

  const [activePlatform, setActivePlatform] = useState<MusicSource>('netease')
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [cookieDialogOpen, setCookieDialogOpen] = useState(false)
  const [cookieDialogPlatform, setCookieDialogPlatform] = useState<MusicSource>('netease')
  const [viewState, setViewState] = useState<ViewState>({ type: 'list' })

  const platforms: MusicSource[] = ['netease', 'tencent', 'kugou']

  // Show "verifying…" only while waiting for the first AUTH_MY_STATUS response.
  // Once the server responds, use the actual status — no more guessing from localStorage.
  const verifyingPlatforms = useMemo(() => {
    if (auth.statusLoaded) return {} // Server has responded — use actual myStatus
    const result: Partial<Record<MusicSource, boolean>> = {}
    for (const p of platforms) {
      result[p] = storage.hasAuthCookie(p)
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.statusLoaded, auth.myStatus])

  const handleQrLogin = useCallback(() => {
    auth.requestQrCode(activePlatform)
    setQrDialogOpen(true)
  }, [auth, activePlatform])

  const handleCookieLogin = useCallback(
    (platform: MusicSource) => {
      setCookieDialogPlatform(platform)
      setCookieDialogOpen(true)
    },
    [],
  )

  const handleCookieSubmit = useCallback(
    (cookie: string) => {
      auth.setCookie(cookieDialogPlatform, cookie)
      setCookieDialogOpen(false)
    },
    [auth, cookieDialogPlatform],
  )

  const handleSelectPlaylist = useCallback(
    (pl: Playlist) => {
      setViewState({ type: 'detail', playlist: pl, source: activePlatform })
      playlist.fetchPlaylistTracks(activePlatform, pl.id, pl.trackCount)
    },
    [activePlatform, playlist],
  )

  const handleLoadByInput = useCallback(
    (playlistId: string) => {
      const fakePl: Playlist = {
        id: playlistId,
        name: `歌单 #${playlistId}`,
        cover: '',
        trackCount: 0,
        source: activePlatform,
      }
      setViewState({ type: 'detail', playlist: fakePl, source: activePlatform })
      playlist.fetchPlaylistTracks(activePlatform, playlistId)
    },
    [activePlatform, playlist],
  )

  const handleBack = useCallback(() => {
    setViewState({ type: 'list' })
  }, [])

  // Detail view — flex-1 min-h-0 so PlaylistDetail gets proper height for virtual scroll
  if (viewState.type === 'detail') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <PlaylistDetail
            playlist={viewState.playlist}
            tracks={playlist.playlistTracks}
            loading={playlist.tracksLoading}
            loadingMore={playlist.loadingMore}
            hasMore={playlist.hasMoreTracks}
            total={playlist.playlistTotal}
            onBack={handleBack}
            onAddTrack={playlist.addTrackToQueue}
            onAddAll={playlist.addBatchToQueue}
            onLoadMore={playlist.loadMoreTracks}
          />
        </div>
      </div>
    )
  }

  // List view — wrapped in ScrollArea since login + playlists may overflow
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="shrink-0">
        <h3 className="pr-8 text-base font-semibold">平台账号 & 歌单</h3>
        <p className="text-muted-foreground mb-3 text-xs">
          登录后可浏览个人歌单，或直接输入歌单链接/ID 导入歌曲
        </p>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <Tabs
          value={activePlatform}
          onValueChange={(v) => setActivePlatform(v as MusicSource)}
          className="overflow-hidden"
        >
          <TabsList className="grid w-full grid-cols-3">
            {platforms.map((p) => (
              <TabsTrigger key={p} value={p} className={PLATFORM_COLORS[p]}>
                {PLATFORM_SHORT_LABELS[p]}
              </TabsTrigger>
            ))}
          </TabsList>

          {platforms.map((p) => (
            <TabsContent key={p} value={p} className="mt-4 space-y-4">
              {/* Login section */}
              <LoginSection
                platform={p}
                status={getPlatformStatus(p, auth.platformStatus)}
                myStatus={getMyPlatformStatus(p, auth.myStatus)}
                isVerifying={verifyingPlatforms[p]}
                onQrLogin={handleQrLogin}
                onCookieLogin={() => handleCookieLogin(p)}
                onLogout={() => auth.logout(p)}
              />

              <Separator />

              {/* Playlist section */}
              <PlaylistSection
                platform={p}
                myStatus={getMyPlatformStatus(p, auth.myStatus)}
                playlists={playlist.myPlaylists[p]}
                loading={playlist.playlistsLoading[p]}
                onFetchMyPlaylists={() => playlist.fetchMyPlaylists(p)}
                onSelectPlaylist={handleSelectPlaylist}
                onLoadByInput={handleLoadByInput}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* QR Dialog */}
      <QrLoginDialog
        open={qrDialogOpen}
        onOpenChange={(open: boolean) => {
          setQrDialogOpen(open)
          if (!open) auth.resetQr()
        }}
        platform={auth.qrPlatform}
        qrData={auth.qrData}
        qrStatus={auth.qrStatus}
        isLoading={auth.isQrLoading}
        onRefresh={() => auth.requestQrCode(auth.qrPlatform)}
        onCheckStatus={(key: string) => auth.checkQrStatus(key)}
      />

      {/* Manual Cookie Dialog */}
      <ManualCookieDialog
        open={cookieDialogOpen}
        onOpenChange={setCookieDialogOpen}
        platform={cookieDialogPlatform}
        onSubmit={handleCookieSubmit}
      />
    </div>
  )
}
