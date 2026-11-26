import { toast } from 'sonner'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import { useVersionStore } from '@/stores/versionStore'

const PRELOAD_RELOAD_KEY = 'mt:vite-preload-reload-attempted'
const PRELOAD_RELOAD_COOLDOWN_MS = 60_000

export function handlePreloadError(event: Event, reload = () => window.location.reload()) {
  if (useRoomStore.getState().room && usePlayerStore.getState().isPlaying) {
    useVersionStore.setState({ hasUpdate: true })
    toast.info('发现新版本，方便时可刷新更新', { id: 'vite-preload-error' })
    return
  }

  try {
    const now = Date.now()
    const lastReload = window.sessionStorage.getItem(PRELOAD_RELOAD_KEY)
    if (lastReload !== null && now - Number(lastReload) <= PRELOAD_RELOAD_COOLDOWN_MS) return
    window.sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(now))
  } catch {
    // Without a persistent guard, let the route error boundary handle the failure.
    return
  }
  event.preventDefault()
  reload()
}
