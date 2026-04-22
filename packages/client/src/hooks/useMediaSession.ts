import { useSocketContext } from '@/providers/SocketProvider'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import type { VoteAction } from '@music-together/shared'
import { defineAbilityFor, EVENTS, TIMING } from '@music-together/shared'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { getVoteActionLabel } from './useVote'

interface MediaSessionControls {
  play: () => void
  pause: () => void
  next: () => void
  prev: () => void
  seek: (time: number) => void
}

/**
 * Integrates with the MediaSession API so hardware media keys
 * (play / pause / next / prev) and the OS media notification bar
 * control the app's synced playback.
 *
 * Mirrors `PlayerControls` permission routing to keep every control
 * entry point (on-screen buttons, media keys, lock-screen widget)
 * behaviourally identical:
 *
 * - If the user can directly perform the action, the media-session
 *   handler invokes the action (which emits the usual socket event).
 * - Else if the user can vote, the handler initiates a vote (available
 *   only for pause/resume/next/prev — no seek-vote exists).
 * - Else the handler is unregistered so the OS hides or greys it out.
 *
 * `seekto` is only registered when the user has direct `seek` permission.
 * Otherwise the optimistic `setCurrentTime` inside `usePlayer.seek` would
 * leave the UI stuck at a fake position after the server rejected the
 * request (no rollback exists — the in-page slider avoids this because
 * it's disabled in the first place).
 *
 * Requirements:
 * - A real `<audio>` / `<video>` element must be playing. Howler runs
 *   with `html5: true`, which satisfies this.
 * - First playback must come from a user gesture (autoplay policy);
 *   media keys work freely after that.
 */
export function useMediaSession({ play, pause, next, prev, seek }: MediaSessionControls) {
  const { socket } = useSocketContext()
  // Build ability directly from roomStore instead of AbilityContext, because
  // usePlayer() (our caller) runs in RoomPage's function body which is
  // *outside* <AbilityProvider>'s subtree — useContext would always return
  // the default member ability regardless of the user's actual role.
  const role = useRoomStore((s) => s.currentUser?.role ?? 'member')
  const ability = useMemo(() => defineAbilityFor(role), [role])
  const canPlay = ability.can('play', 'Player')
  const canSeek = ability.can('seek', 'Player')
  const canNext = ability.can('next', 'Player')
  const canPrev = ability.can('prev', 'Player')
  const canVote = ability.can('vote', 'Player')

  // Keep latest callbacks in refs so action handlers never go stale
  // without having to rebind on every render.
  const callbacksRef = useRef({ play, pause, next, prev, seek })
  useEffect(() => {
    callbacksRef.current = { play, pause, next, prev, seek }
  }, [play, pause, next, prev, seek])

  // Vote starter for member fall-back. Mirrors `useVote.startVote` but
  // kept local to avoid depending on a hook that only exists once per
  // tree (it lives inside AudioPlayer).
  // Debounce matches PlayerControls' cooldown to prevent toast spam from
  // rapid media-key presses.
  const lastVoteRef = useRef(0)
  const startVote = useCallback(
    (action: VoteAction) => {
      const now = Date.now()
      if (now - lastVoteRef.current < TIMING.PLAYER_NEXT_DEBOUNCE_MS) return
      lastVoteRef.current = now
      socket.emit(EVENTS.VOTE_START, { action })
      toast.info(`已发起投票：${getVoteActionLabel(action)}`)
    },
    [socket],
  )

  // Register action handlers based on the current ability.
  // Re-runs on permission change so role up/down takes effect immediately.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const ms = navigator.mediaSession

    // play / pause — direct control or vote fallback (resume/pause).
    if (canPlay) {
      ms.setActionHandler('play', () => callbacksRef.current.play())
      ms.setActionHandler('pause', () => callbacksRef.current.pause())
    } else if (canVote) {
      ms.setActionHandler('play', () => startVote('resume'))
      ms.setActionHandler('pause', () => startVote('pause'))
    } else {
      ms.setActionHandler('play', null)
      ms.setActionHandler('pause', null)
    }

    // next
    if (canNext) {
      ms.setActionHandler('nexttrack', () => callbacksRef.current.next())
    } else if (canVote) {
      ms.setActionHandler('nexttrack', () => startVote('next'))
    } else {
      ms.setActionHandler('nexttrack', null)
    }

    // prev
    if (canPrev) {
      ms.setActionHandler('previoustrack', () => callbacksRef.current.prev())
    } else if (canVote) {
      ms.setActionHandler('previoustrack', () => startVote('prev'))
    } else {
      ms.setActionHandler('previoustrack', null)
    }

    // seekto — direct only; no voting equivalent.
    if (canSeek) {
      ms.setActionHandler('seekto', (details) => {
        if (details.seekTime != null) {
          callbacksRef.current.seek(details.seekTime)
        }
      })
    } else {
      ms.setActionHandler('seekto', null)
    }

    return () => {
      ms.setActionHandler('play', null)
      ms.setActionHandler('pause', null)
      ms.setActionHandler('nexttrack', null)
      ms.setActionHandler('previoustrack', null)
      ms.setActionHandler('seekto', null)
    }
  }, [canPlay, canSeek, canNext, canPrev, canVote, startVote])

  // Metadata — current track info for the OS notification bar.
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const ms = navigator.mediaSession

    if (currentTrack) {
      ms.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist.join(' / '),
        album: currentTrack.album || '',
        artwork: currentTrack.cover ? [{ src: currentTrack.cover, sizes: '512x512', type: 'image/jpeg' }] : [],
      })
    } else {
      ms.metadata = null
    }

    return () => {
      ms.metadata = null
    }
  }, [currentTrack])

  // Playback state.
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'

    return () => {
      navigator.mediaSession.playbackState = 'none'
    }
  }, [isPlaying])

  // Position state.  Browsers interpolate using `playbackRate`, so we only
  // need to sync on meaningful state changes: play/pause toggles, duration
  // updates, or seeks.  Syncing on every `currentTime` tick is wasteful.
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const prevIsPlayingRef = useRef(isPlaying)
  const prevDurationRef = useRef(duration)
  const prevPositionRef = useRef(currentTime)

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (!duration || !isFinite(duration)) return

    const playStateChanged = isPlaying !== prevIsPlayingRef.current
    const durationChanged = duration !== prevDurationRef.current
    // Detect a seek: position jumped more than ~2s away from linear progression.
    const expectedDelta = prevIsPlayingRef.current ? 1 : 0
    const isSeek = Math.abs(currentTime - prevPositionRef.current - expectedDelta) > 2

    if (!playStateChanged && !durationChanged && !isSeek) return

    prevIsPlayingRef.current = isPlaying
    prevDurationRef.current = duration
    prevPositionRef.current = currentTime

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(Math.max(0, currentTime), duration),
      })
    } catch {
      // setPositionState throws if position > duration; ignore gracefully.
    }
  }, [isPlaying, duration, currentTime])
}
