import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { MusicSource, MyPlatformAuth, Playlist } from '@music-together/shared'
import { ListMusic, RefreshCw, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { parsePlaylistInput } from '@/hooks/usePlaylist'

interface PlaylistSectionProps {
  platform: MusicSource
  myStatus?: MyPlatformAuth
  playlists: Playlist[]
  loading: boolean
  onFetchMyPlaylists: () => void
  onSelectPlaylist: (playlist: Playlist) => void
  onLoadByInput: (playlistId: string) => void
}

function PlaylistSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg p-2">
      <Skeleton className="h-12 w-12 shrink-0 rounded-md" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  )
}

export function PlaylistSection({
  platform,
  myStatus,
  playlists,
  loading,
  onFetchMyPlaylists,
  onSelectPlaylist,
  onLoadByInput,
}: PlaylistSectionProps) {
  const [inputValue, setInputValue] = useState('')
  const isLoggedIn = myStatus?.loggedIn ?? false

  // Auto-fetch playlists when logged in and no playlists loaded
  useEffect(() => {
    if (isLoggedIn && playlists.length === 0 && !loading) {
      onFetchMyPlaylists()
    }
  }, [isLoggedIn, playlists.length, loading, onFetchMyPlaylists])

  const handleManualLoad = useCallback(() => {
    const parsed = parsePlaylistInput(inputValue, platform)
    if (parsed) {
      onLoadByInput(parsed)
      setInputValue('')
    }
  }, [inputValue, platform, onLoadByInput])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleManualLoad()
      }
    },
    [handleManualLoad],
  )

  return (
    <div className="min-w-0 space-y-4 overflow-hidden">
      {/* Manual input */}
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">输入歌单链接或 ID 来加载歌单</p>
        <div className="flex gap-2">
          <Input
            placeholder="歌单 URL 或 ID..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleManualLoad}
            disabled={!inputValue.trim()}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* My playlists */}
      {isLoggedIn && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">我的歌单</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={onFetchMyPlaylists}
              disabled={loading}
              className="text-muted-foreground h-7 gap-1 px-2 text-xs"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>

          {loading && playlists.length === 0 ? (
            <div className="space-y-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <PlaylistSkeleton key={i} />
              ))}
            </div>
          ) : playlists.length > 0 ? (
            <div className="space-y-0.5">
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  className="hover:bg-accent flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-lg p-2 text-left transition-colors"
                  onClick={() => onSelectPlaylist(pl)}
                >
                  {pl.cover ? (
                    <img
                      src={pl.cover}
                      alt={pl.name}
                      className="h-12 w-12 shrink-0 rounded-md object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="bg-muted flex h-12 w-12 shrink-0 items-center justify-center rounded-md">
                      <ListMusic className="text-muted-foreground h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{pl.name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {pl.trackCount} 首{pl.creator ? ` · ${pl.creator}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-4 text-center text-xs">暂无歌单</p>
          )}
        </div>
      )}
    </div>
  )
}
