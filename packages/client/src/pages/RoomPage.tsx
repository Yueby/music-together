import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { EVENTS } from '@music-together/shared'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { InteractionGate } from '@/components/InteractionGate'
import { AudioPlayer } from '@/components/Player/AudioPlayer'
import { ChatPanel } from '@/components/Chat/ChatPanel'
import { RoomHeader } from '@/components/Room/RoomHeader'
import { SearchDialog } from '@/components/Overlays/SearchDialog'
import { QueueDrawer } from '@/components/Overlays/QueueDrawer'
import { SettingsDialog, type SettingsTab } from '@/components/Overlays/SettingsDialog'
import { PasswordDialog } from '@/components/Lobby/PasswordDialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'
import { isAudioUnlocked, unlockAudio } from '@/lib/audioUnlock'
import { SERVER_URL } from '@/lib/config'
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

/** Invisible component that runs NTP clock-sync only while in a room. */
function ClockSyncRunner() {
  useClockSync()
  return null
}

interface RoomCheckInfo {
  name: string
  hasPassword: boolean
  userCount: number
}

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { socket, isConnected } = useSocketContext()
  const { leaveRoom, updateSettings, setUserRole } = useRoom()
  const { play, pause, seek, next, prev } = usePlayer()
  const { addTrack, removeTrack, reorderTracks, clearQueue } = useQueue()

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
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab | undefined>(undefined)

  // Fallback password dialog state (edge case: password changed after pre-check)
  const [passwordNeeded, setPasswordNeeded] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordLoading, setPasswordLoading] = useState(false)

  const joiningRef = useRef(false)
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

    let cancelled = false
    const controller = new AbortController()

    async function checkRoom() {
      try {
        const res = await fetch(`${SERVER_URL}/api/rooms/${roomId}/check`, {
          signal: controller.signal,
        })
        if (cancelled) return

        if (!res.ok) {
          // Room not found
          toast.error('房间不存在')
          navigate('/', { replace: true })
          return
        }

        const data = await res.json()
        setRoomInfo({
          name: data.name,
          hasPassword: data.hasPassword,
          userCount: data.userCount,
        })
      } catch (err) {
        if (cancelled) return
        // Network error — still allow the user to try (gate will show, join may fail)
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
    // `room` is excluded intentionally — this effect only runs on mount / roomId change.
    // `navigate` is stable (React Router guarantee) and would cause unnecessary re-runs if included.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  // --- Gate start handler (receives password from gate if applicable) ---
  const handleGateStart = useCallback(async (password?: string) => {
    await unlockAudio()
    if (password) passwordRef.current = password
    setGatePasswordError(null)
    setGateOpen(true)
  }, [])

  // --- Auto-join if room state is missing (e.g. page refresh, direct URL access) ---
  // Only after the interaction gate is open — avoids autoplay warnings.
  useEffect(() => {
    if (!gateOpen) return
    if (isLeavingRef.current) return
    if (!room && isConnected && !joiningRef.current && roomId) {
      joiningRef.current = true
      const nickname = storage.getNickname()
      if (!nickname) {
        joiningRef.current = false
        setGateOpen(false) // Re-show InteractionGate so user can set nickname
        return
      }
      socket.emit(EVENTS.ROOM_JOIN, {
        roomId,
        nickname,
        password: passwordRef.current || undefined,
        userId: storage.getUserId(),
      })
    }
    if (room) {
      joiningRef.current = false
    }
  }, [gateOpen, room, isConnected, socket, roomId])

  // --- Handle ROOM_ERROR — password errors, fallback dialog ---
  useEffect(() => {
    const onRoomError = (error: { code: string; message: string }) => {
      joiningRef.current = false

      if (error.code === 'WRONG_PASSWORD') {
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
          setGatePasswordError('密码错误，请重试')
          passwordRef.current = undefined
          return
        }

        // Fallback password dialog path
        if (passwordNeeded) {
          setPasswordError('密码错误，请重试')
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

  // No unmount cleanup needed — the server handles room membership:
  // - On disconnect: server's disconnect handler removes user
  // - On join/create another room: server auto-leaves old room
  // - On explicit leave: user clicks the leave button below

  const handlePasswordSubmit = useCallback((password: string) => {
    if (!roomId) return
    const nickname = storage.getNickname()
    if (!nickname) return
    setPasswordLoading(true)
    setPasswordError(null)
    socket.emit(EVENTS.ROOM_JOIN, { roomId, nickname, password, userId: storage.getUserId() })
  }, [socket, roomId])

  // If password dialog is dismissed without submitting, navigate home
  const handlePasswordOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setPasswordNeeded(false)
      setPasswordError(null)
      navigate('/', { replace: true })
    }
  }, [navigate])

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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
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
            onOpenMembers={handleOpenMembers}
            onLeaveRoom={handleLeaveRoom}
          />

          <div className="flex min-h-0 flex-1 overflow-hidden p-2 md:p-3">
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
                chatOpen ? 'w-[380px] pl-3' : 'w-0',
              )}
            >
              <div className="flex h-full w-[380px] flex-col">
                {chatOpen && <ChatPanel />}
              </div>
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
