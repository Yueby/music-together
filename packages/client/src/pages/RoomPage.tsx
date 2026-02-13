import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { EVENTS } from '@music-together/shared'
import { motion } from 'motion/react'
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
import { useRoom } from '@/hooks/useRoom'
import { usePlayer } from '@/hooks/usePlayer'
import { useQueue } from '@/hooks/useQueue'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useRoomStore } from '@/stores/roomStore'
import { useChatStore } from '@/stores/chatStore'
import { useSocketContext } from '@/providers/SocketProvider'
import { AbilityProvider } from '@/providers/AbilityProvider'
import { storage } from '@/lib/storage'

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { socket, isConnected } = useSocketContext()
  const { leaveRoom, updateSettings, setUserRole } = useRoom()
  const { play, pause, seek, next, prev } = usePlayer()
  const { addTrack, removeTrack, reorderTracks } = useQueue()

  const room = useRoomStore((s) => s.room)
  const chatOpen = useChatStore((s) => s.isChatOpen)
  const setChatOpen = useChatStore((s) => s.setIsChatOpen)
  const chatUnreadCount = useChatStore((s) => s.unreadCount)
  const isMobile = useIsMobile()

  // Gate: audio must be unlocked before joining the room.
  // From lobby: isAudioUnlocked() is already true → gate skipped, auto-join runs immediately.
  // Direct URL / page refresh: gate blocks until user clicks "开始收听".
  const [gateOpen, setGateOpen] = useState(() => isAudioUnlocked())

  const [searchOpen, setSearchOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab | undefined>(undefined)
  const [passwordNeeded, setPasswordNeeded] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordLoading, setPasswordLoading] = useState(false)

  const joiningRef = useRef(false)
  const isLeavingRef = useRef(false)

  const handleGateStart = useCallback(async () => {
    await unlockAudio()
    setGateOpen(true)
  }, [])

  // Auto-join if room state is missing (e.g. page refresh, direct URL access)
  // Only after the interaction gate is open — avoids autoplay warnings.
  useEffect(() => {
    if (!gateOpen) return
    if (isLeavingRef.current) return
    if (!room && isConnected && !joiningRef.current && roomId) {
      joiningRef.current = true
      const nickname = storage.getNickname() || 'Guest'
      socket.emit(EVENTS.ROOM_JOIN, { roomId, nickname })
    }
    if (room) {
      joiningRef.current = false
    }
  }, [gateOpen, room, isConnected, socket, roomId])

  // Handle ROOM_ERROR — detect WRONG_PASSWORD to show password dialog
  useEffect(() => {
    const onRoomError = (error: { code: string; message: string }) => {
      joiningRef.current = false
      if (error.code === 'WRONG_PASSWORD') {
        setPasswordNeeded(true)
        setPasswordLoading(false)
        // Don't set error on first prompt — only on retry
      }
    }
    // On successful join, dismiss the password dialog
    const onRoomState = () => {
      if (passwordNeeded) {
        setPasswordNeeded(false)
        setPasswordError(null)
        setPasswordLoading(false)
      }
    }
    socket.on(EVENTS.ROOM_ERROR, onRoomError)
    socket.on(EVENTS.ROOM_STATE, onRoomState)
    return () => {
      socket.off(EVENTS.ROOM_ERROR, onRoomError)
      socket.off(EVENTS.ROOM_STATE, onRoomState)
    }
  }, [socket, passwordNeeded])

  // No unmount cleanup needed — the server handles room membership:
  // - On disconnect: server's disconnect handler removes user
  // - On join/create another room: server auto-leaves old room
  // - On explicit leave: user clicks the leave button below

  const handlePasswordSubmit = useCallback((password: string) => {
    if (!roomId) return
    const nickname = storage.getNickname() || 'Guest'
    setPasswordLoading(true)
    setPasswordError(null)
    socket.emit(EVENTS.ROOM_JOIN, { roomId, nickname, password })
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

  if (!gateOpen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <InteractionGate onStart={handleGateStart} />
      </motion.div>
    )
  }

  return (
    <AbilityProvider>
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
                onOpenChat={() => setChatOpen(!chatOpen)}
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

        {/* Password dialog for reconnecting to password-protected rooms */}
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
