import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import { EVENTS, ERROR_CODE } from '@music-together/shared'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { InteractionGate } from '@/components/InteractionGate'
import { AudioPlayer } from '@/components/Player/AudioPlayer'
import { ChatPanel } from '@/components/Chat/ChatPanel'
import { RoomHeader } from '@/components/Room/RoomHeader'
import { SearchDialog } from '@/components/Overlays/SearchDialog'
import { QueueDrawer } from '@/components/Overlays/QueueDrawer'
import { AccountDialog } from '@/components/Overlays/AccountDialog'
import { ArtistDialog } from '@/components/Overlays/ArtistDialog'
import { SettingsDialog, type SettingsTab } from '@/components/Overlays/SettingsDialog'
import { PasswordDialog } from '@/components/Lobby/PasswordDialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'
import { isAudioUnlocked, unlockAudio } from '@/lib/audioUnlock'
import { roomCheck } from '@/lib/roomCheck'
import { wrongPasswordText } from '@/lib/passwordErrorText'
import type { RoomCheckInfo } from '@/lib/RoomCheckReader'
import { useRoom } from '@/hooks/useRoom'
import { usePlayer } from '@/hooks/usePlayer'
import { useQueue } from '@/hooks/useQueue'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useRoomStore } from '@/stores/roomStore'
import { useChatStore } from '@/stores/chatStore'
import { useSocketContext } from '@/providers/SocketProvider'
import { AbilityProvider } from '@/providers/AbilityProvider'
import { useClockSync } from '@/hooks/useClockSync'
import { storage } from '@/lib/storage'
import { roomCommands } from '@/lib/RoomCommands'

/** Invisible component that runs NTP clock-sync only while in a room. */
function ClockSyncRunner() {
  useClockSync()
  return null
}

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { socket, isConnected, requiresManualJoin } = useSocketContext()
  const { leaveRoom, updateSettings, setUserRole } = useRoom()
  const { play, pause, seek, next, prev } = usePlayer()
  const { addTrack, insertAfterCurrent, removeTrack, reorderTracks, clearQueue } = useQueue()

  const room = useRoomStore((s) => s.room)
  const chatOpen = useChatStore((s) => s.isChatOpen)
  const setChatOpen = useChatStore((s) => s.setIsChatOpen)
  const chatUnreadCount = useChatStore((s) => s.unreadCount)
  const toggleChat = useCallback(() => {
    setChatOpen(!useChatStore.getState().isChatOpen)
  }, [setChatOpen])
  const isMobile = useIsMobile()

  // --- Pre-check state ---
  const [checking, setChecking] = useState(true)
  const [roomInfo, setRoomInfo] = useState<RoomCheckInfo | null>(null)

  // Gate: audio must be unlocked before joining the room.
  // From lobby: isAudioUnlocked() is already true → gate skipped, auto-join runs immediately.
  // Direct URL / page refresh: gate blocks until user clicks "开始收听".
  const [gateOpen, setGateOpen] = useState(() => isAudioUnlocked())
  const [gatePasswordError, setGatePasswordError] = useState<string | null>(null)

  const [searchOpen, setSearchOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab | undefined>(undefined)

  // Fallback password dialog state (edge case: password changed after pre-check)
  const [passwordNeeded, setPasswordNeeded] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordLoading, setPasswordLoading] = useState(false)

  const joiningRef = useRef(false)
  const manualJoinRef = useRef(false)
  const isLeavingRef = useRef(false)
  const passwordRef = useRef<string | undefined>(undefined)

  // --- Pre-check: fetch room existence & password requirement ---
  useEffect(() => {
    if (!roomId) {
      navigate('/', { replace: true })
      return
    }

    // If already in this room (e.g. navigated from lobby), skip pre-check
    if (room && room.id === roomId) {
      setChecking(false)
      return
    }

    const checkedRoomId = roomId
    let cancelled = false
    const controller = new AbortController()

    async function checkRoom() {
      try {
        const data = await roomCheck(socket, checkedRoomId, { signal: controller.signal })
        if (cancelled) return

        if (!data) {
          // Room not found
          toast.error('房间不存在')
          navigate('/', { replace: true })
          return
        }

        setRoomInfo(data)
      } catch (err) {
        if (cancelled) return
        // Network / transient HTTP error (502, 503, 429, ...) — the room may well exist,
        // so don't bounce to the lobby: still allow the user to try (gate will show, join may fail)
        console.warn('Room pre-check failed:', err)
        setRoomInfo(null)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    checkRoom()
    return () => {
      cancelled = true
      controller.abort()
    }
    // `room` is excluded intentionally — pre-check follows roomId or the host socket, not room broadcasts.
    // `navigate` is stable (React Router guarantee) and would cause unnecessary re-runs if included.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, socket])

  // --- Gate start handler (receives password from gate if applicable) ---
  const handleGateStart = useCallback(async (password?: string) => {
    await unlockAudio()
    if (password) passwordRef.current = password
    manualJoinRef.current = true
    setGatePasswordError(null)
    setGateOpen(true)
  }, [])

  // A join that was sent right before the socket dropped will never be answered
  // with ROOM_STATE, so the in-flight flag must not survive the disconnect —
  // otherwise the auto-join below would never re-run after reconnecting.
  useEffect(() => {
    if (!isConnected) joiningRef.current = false
  }, [isConnected])

  // --- Auto-join if room state is missing (e.g. page refresh, direct URL access) ---
  // Only after the interaction gate is open — avoids autoplay warnings.
  useEffect(() => {
    if (!gateOpen) return
    if (isLeavingRef.current) return
    if (requiresManualJoin && !manualJoinRef.current) {
      joiningRef.current = false
      passwordRef.current = undefined
      setGateOpen(false)
      return
    }
    if (!room && isConnected && !joiningRef.current && roomId) {
      joiningRef.current = true
      const nickname = storage.getNickname()
      if (!nickname) {
        joiningRef.current = false
        setGateOpen(false) // Re-show InteractionGate so user can set nickname
        return
      }
      const accepted = roomCommands.join(
        socket,
        {
          roomId,
          nickname,
          password: passwordRef.current || undefined,
          rejoinToken: storage.getRejoinToken(roomId) ?? undefined,
        },
        { automatic: !manualJoinRef.current },
      )
      joiningRef.current = accepted
      manualJoinRef.current = false
    }
    if (room) {
      joiningRef.current = false
    }
  }, [gateOpen, room, isConnected, socket, roomId, requiresManualJoin])

  // --- Handle ROOM_ERROR — password errors, fallback dialog ---
  useEffect(() => {
    const onRoomError = (error: { code: string; message: string }) => {
      joiningRef.current = false

      if (error.code === ERROR_CODE.WRONG_PASSWORD) {
        // If we came through the gate, revert to gate with error
        if (!passwordNeeded && !gateOpen) {
          // Gate was not yet open — shouldn't happen, but handle gracefully
          setPasswordNeeded(true)
          return
        }

        if (gateOpen && !passwordNeeded) {
          // Password was sent from gate but rejected (e.g. race condition / password changed)
          // Reset gate so user can re-enter password
          setGateOpen(false)
          setGatePasswordError(wrongPasswordText(error.message))
          passwordRef.current = undefined
          return
        }

        // Fallback password dialog path
        if (passwordNeeded) {
          setPasswordError(wrongPasswordText(error.message))
          setPasswordLoading(false)
        } else {
          setPasswordNeeded(true)
          setPasswordLoading(false)
        }
      }
    }

    // On successful join, dismiss any password state
    const onRoomState = () => {
      if (passwordNeeded) {
        setPasswordNeeded(false)
        setPasswordError(null)
        setPasswordLoading(false)
      }
      setGatePasswordError(null)
    }

    socket.on(EVENTS.ROOM_ERROR, onRoomError)
    socket.on(EVENTS.ROOM_STATE, onRoomState)
    return () => {
      socket.off(EVENTS.ROOM_ERROR, onRoomError)
      socket.off(EVENTS.ROOM_STATE, onRoomState)
    }
  }, [socket, passwordNeeded, gateOpen])

  // Leave the room when the page unmounts without an explicit leave (browser /
  // phone back button, route change, error-boundary reset). Otherwise the server
  // keeps treating this user as a member (possibly the conductor) while the audio
  // is gone, which stalls playback for the whole room.
  //
  // The decision is deferred by one macrotask: React StrictMode (dev) runs
  // cleanup -> setup synchronously on the same instance, and the setup flips
  // `mountedRef` back to true before the timer fires, so a simulated remount
  // never emits ROOM_LEAVE. Page refresh / tab close never runs cleanup at all
  // (the server's disconnect handler covers those).
  const mountedRef = useRef(false)
  const leaveRoomRef = useRef(leaveRoom)
  leaveRoomRef.current = leaveRoom
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      setTimeout(() => {
        if (mountedRef.current || isLeavingRef.current) return
        // Disconnected: the server already dropped us and the connection guard
        // reset the stores. Emitting now would be buffered and replayed after reconnect.
        if (!socket.connected) return
        // Nothing to leave if we never joined and no join is in flight.
        if (!useRoomStore.getState().room && !joiningRef.current) return
        leaveRoomRef.current()
      }, 0)
    }
  }, [socket])

  const handlePasswordSubmit = useCallback(
    (password: string) => {
      if (!roomId) return
      const nickname = storage.getNickname()
      if (!nickname) return
      setPasswordLoading(true)
      setPasswordError(null)
      roomCommands.join(socket, {
        roomId,
        nickname,
        password,
        rejoinToken: storage.getRejoinToken(roomId) ?? undefined,
      })
    },
    [socket, roomId],
  )

  // If password dialog is dismissed without submitting, navigate home
  const handlePasswordOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setPasswordNeeded(false)
        setPasswordError(null)
        navigate('/', { replace: true })
      }
    },
    [navigate],
  )

  const handleOpenMembers = useCallback(() => {
    setSettingsInitialTab('members')
    setSettingsOpen(true)
  }, [])

  const handleLeaveRoom = useCallback(() => {
    isLeavingRef.current = true
    leaveRoom()
    navigate('/', { replace: true })
  }, [leaveRoom, navigate])

  // --- Loading state during pre-check ---
  if (checking) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">正在检查房间...</p>
        </motion.div>
      </div>
    )
  }

  // --- Interaction gate (audio unlock + optional password) ---
  if (!gateOpen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <InteractionGate
          onStart={handleGateStart}
          roomName={roomInfo?.name}
          hasPassword={roomInfo?.hasPassword || !!gatePasswordError}
          passwordError={gatePasswordError}
        />
      </motion.div>
    )
  }

  return (
    <AbilityProvider>
      <ClockSyncRunner />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex h-dvh flex-col bg-background">
          <RoomHeader
            onOpenSearch={() => setSearchOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenAccount={() => setAccountOpen(true)}
            onOpenMembers={handleOpenMembers}
            onLeaveRoom={handleLeaveRoom}
          />

          <div className="flex min-h-0 flex-1 overflow-hidden p-2 md:p-3 lg:p-4">
            <div className="min-w-0 flex-1 overflow-hidden rounded-2xl">
              <AudioPlayer
                onPlay={play}
                onPause={pause}
                onSeek={seek}
                onNext={next}
                onPrev={prev}
                onOpenChat={toggleChat}
                onOpenQueue={() => setQueueOpen(true)}
                chatUnreadCount={chatUnreadCount}
              />
            </div>

            {/* Desktop: inline chat panel that squeezes the player */}
            <div
              className={cn(
                'hidden h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-out md:block',
                chatOpen ? 'w-[320px] pl-3' : 'w-0',
              )}
            >
              <div className="flex h-full w-[320px] flex-col">{chatOpen && <ChatPanel />}</div>
            </div>
          </div>

          {/* Mobile: chat drawer from bottom */}
          {isMobile && (
            <Drawer open={chatOpen} onOpenChange={setChatOpen}>
              <DrawerContent className="flex h-[70vh] flex-col p-0">
                <DrawerHeader className="sr-only">
                  <DrawerTitle>聊天</DrawerTitle>
                </DrawerHeader>
                <ChatPanel />
              </DrawerContent>
            </Drawer>
          )}

          <SearchDialog
            open={searchOpen}
            onOpenChange={setSearchOpen}
            onAddToQueue={addTrack}
            onInsertAfterCurrent={insertAfterCurrent}
          />
          <QueueDrawer
            open={queueOpen}
            onOpenChange={setQueueOpen}
            onRemoveFromQueue={removeTrack}
            onReorderQueue={reorderTracks}
            onClearQueue={clearQueue}
          />
          <SettingsDialog
            open={settingsOpen}
            onOpenChange={(open) => {
              setSettingsOpen(open)
              if (!open) setSettingsInitialTab(undefined)
            }}
            onUpdateSettings={updateSettings}
            onSetUserRole={setUserRole}
            initialTab={settingsInitialTab}
          />
          <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
          <ArtistDialog />
        </div>

        {/* Fallback password dialog for edge cases (password changed after pre-check) */}
        <PasswordDialog
          open={passwordNeeded}
          onOpenChange={handlePasswordOpenChange}
          roomName={room?.name ?? roomId ?? ''}
          onSubmit={handlePasswordSubmit}
          error={passwordError}
          isLoading={passwordLoading}
        />
      </motion.div>
    </AbilityProvider>
  )
}
