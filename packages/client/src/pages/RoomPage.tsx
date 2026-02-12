import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { EVENTS } from '@music-together/shared'
import { InteractionGate } from '@/components/InteractionGate'
import { AudioPlayer } from '@/components/Player/AudioPlayer'
import { ChatPanel } from '@/components/Chat/ChatPanel'
import { RoomHeader } from '@/components/Room/RoomHeader'
import { SearchDialog } from '@/components/Overlays/SearchDialog'
import { QueueDrawer } from '@/components/Overlays/QueueDrawer'
import { SettingsDialog } from '@/components/Overlays/SettingsDialog'
import { ResizeHandle } from '@/components/ui/resize-handle'
import { useRoom } from '@/hooks/useRoom'
import { usePlayer } from '@/hooks/usePlayer'
import { useQueue } from '@/hooks/useQueue'
import { useRoomStore } from '@/stores/roomStore'
import { useChatStore, DEFAULT_CHAT_WIDTH } from '@/stores/chatStore'
import { useSocketContext } from '@/providers/SocketProvider'
import { storage } from '@/lib/storage'

const MIN_CHAT_WIDTH = 200
const MAX_CHAT_WIDTH = 600

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { socket, isConnected } = useSocketContext()
  const { leaveRoom, updateSettings } = useRoom()
  const { play, pause, seek, next } = usePlayer()
  const { addTrack, removeTrack, reorderTracks } = useQueue()

  const room = useRoomStore((s) => s.room)
  const chatWidth = useChatStore((s) => s.chatWidth)
  const setChatWidth = useChatStore((s) => s.setChatWidth)

  const [searchOpen, setSearchOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const dragWidthRef = useRef(chatWidth)
  const joiningRef = useRef(false)
  const isLeavingRef = useRef(false)

  // Auto-join if room state is missing (e.g. page refresh, direct URL access)
  useEffect(() => {
    if (isLeavingRef.current) return
    if (!room && isConnected && !joiningRef.current && roomId) {
      joiningRef.current = true
      const nickname = storage.getNickname() || 'Guest'
      socket.emit(EVENTS.ROOM_JOIN, { roomId, nickname })
    }
    if (room) {
      joiningRef.current = false
    }
  }, [room, isConnected, socket, roomId])

  // Reset joiningRef on ROOM_ERROR so retries work
  useEffect(() => {
    const onRoomError = () => {
      joiningRef.current = false
    }
    socket.on(EVENTS.ROOM_ERROR, onRoomError)
    return () => {
      socket.off(EVENTS.ROOM_ERROR, onRoomError)
    }
  }, [socket])

  // No unmount cleanup needed — the server handles room membership:
  // - On disconnect: server's disconnect handler removes user
  // - On join/create another room: server auto-leaves old room
  // - On explicit leave: user clicks the leave button below

  const handleLeaveRoom = useCallback(() => {
    isLeavingRef.current = true
    leaveRoom()
    navigate('/', { replace: true })
  }, [leaveRoom, navigate])

  const handleResize = useCallback(
    (delta: number) => {
      setChatWidth((prev: number) => {
        const newWidth = Math.max(0, Math.min(MAX_CHAT_WIDTH, prev - delta))
        dragWidthRef.current = newWidth
        return newWidth
      })
    },
    [setChatWidth],
  )

  const handleResizeEnd = useCallback(() => {
    const w = dragWidthRef.current
    if (w > 0 && w < MIN_CHAT_WIDTH) {
      setChatWidth(0)
      dragWidthRef.current = 0
    }
  }, [setChatWidth])

  const handleDoubleClick = useCallback(() => {
    setChatWidth(DEFAULT_CHAT_WIDTH)
    dragWidthRef.current = DEFAULT_CHAT_WIDTH
  }, [setChatWidth])

  return (
    <InteractionGate>
      <div className="flex h-screen flex-col bg-background">
        <RoomHeader
          onOpenSearch={() => setSearchOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onLeaveRoom={handleLeaveRoom}
        />

        <div className="flex min-h-0 flex-1 overflow-hidden p-2 md:p-3">
          <div className="min-w-0 flex-1 overflow-hidden rounded-2xl">
            <AudioPlayer
              onPlay={play}
              onPause={pause}
              onSeek={seek}
              onNext={next}
              onOpenQueue={() => setQueueOpen(true)}
            />
          </div>

          <ResizeHandle
            onResize={handleResize}
            onResizeEnd={handleResizeEnd}
            onDoubleClick={handleDoubleClick}
            collapsed={chatWidth === 0}
          />

          {/* Chat panel — always mounted, CSS controls visibility */}
          <div
            className="h-full shrink-0 overflow-hidden"
            style={{ width: chatWidth }}
          >
            {chatWidth > 0 && <ChatPanel />}
          </div>
        </div>

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
          onOpenChange={setSettingsOpen}
          onUpdateSettings={updateSettings}
        />
      </div>
    </InteractionGate>
  )
}
