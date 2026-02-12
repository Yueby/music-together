import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import type { Track } from '@music-together/shared'
import { EVENTS } from '@music-together/shared'
import { InteractionGate } from '@/components/InteractionGate'
import { AudioPlayer } from '@/components/Player/AudioPlayer'
import { ChatPanel } from '@/components/Chat/ChatPanel'
import { RoomHeader } from '@/components/Room/RoomHeader'
import { SearchDialog } from '@/components/Overlays/SearchDialog'
import { QueueDrawer } from '@/components/Overlays/QueueDrawer'
import { SettingsDialog } from '@/components/Overlays/SettingsDialog'
import { ResizeHandle } from '@/components/ui/resize-handle'
import { useSocket } from '@/hooks/useSocket'
import { useRoom } from '@/hooks/useRoom'
import { usePlayer } from '@/hooks/usePlayer'
import { useRoomStore } from '@/stores/roomStore'
import { useChatStore, DEFAULT_CHAT_WIDTH } from '@/stores/chatStore'

const MIN_CHAT_WIDTH = 200
const MAX_CHAT_WIDTH = 600
const SNAP_THRESHOLD = 100 // When dragging from collapsed, snap open after 100px

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const socket = useSocket()
  const { leaveRoom, updateSettings } = useRoom(socket)
  const { play, pause, seek, next } = usePlayer(socket)

  const room = useRoomStore((s) => s.room)
  const isConnected = useRoomStore((s) => s.isConnected)
  const chatWidth = useChatStore((s) => s.chatWidth)
  const setChatWidth = useChatStore((s) => s.setChatWidth)

  const [searchOpen, setSearchOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Track the live drag width separately so we can apply snap on release
  const dragWidthRef = useRef(chatWidth)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const joiningRef = useRef(false)

  // If room state is missing (e.g. direct navigation or ROOM_STATE was missed),
  // re-join as soon as the socket is connected. Using reactive `isConnected`
  // ensures this fires even if the socket connects after the first render.
  // joiningRef prevents StrictMode's double-mount from sending two ROOM_JOIN events.
  useEffect(() => {
    if (!room && isConnected && !joiningRef.current) {
      joiningRef.current = true
      const nickname = localStorage.getItem('mt-nickname') || 'Guest'
      socket.emit(EVENTS.ROOM_JOIN, { roomId, nickname })
    }
    if (room) {
      joiningRef.current = false
    }
  }, [room, isConnected, socket, roomId])

  // Leave room on real unmount.
  // Uses a delayed timer so that React Strict Mode's simulated unmount/re-mount
  // can cancel the leave before it fires. On real unmount there's no re-mount
  // so the timer executes and the user properly leaves.
  useEffect(() => {
    // On (re-)mount, cancel any pending leave from a previous cleanup
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }

    return () => {
      leaveTimerRef.current = setTimeout(() => {
        leaveRoom()
      }, 100)
    }
  }, [leaveRoom])

  const handleResize = useCallback(
    (delta: number) => {
      // Negative delta = mouse moved left = chat panel grows (since it's on the right)
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
    // Snap logic: if below min but nonzero, snap to 0 (hide)
    if (w > 0 && w < MIN_CHAT_WIDTH) {
      setChatWidth(0)
      dragWidthRef.current = 0
    }
  }, [setChatWidth])

  const handleDoubleClick = useCallback(() => {
    setChatWidth(DEFAULT_CHAT_WIDTH)
    dragWidthRef.current = DEFAULT_CHAT_WIDTH
  }, [setChatWidth])

  const handleAddToQueue = (track: Track) => {
    socket.emit(EVENTS.QUEUE_ADD, { track })
  }

  const handleRemoveFromQueue = (trackId: string) => {
    socket.emit(EVENTS.QUEUE_REMOVE, { trackId })
  }

  const handleReorderQueue = (trackIds: string[]) => {
    socket.emit(EVENTS.QUEUE_REORDER, { trackIds })
  }

  const handleUpdateMode = (mode: 'host-only' | 'collaborative') => {
    updateSettings({ mode })
  }

  return (
    <InteractionGate>
      <div className="flex h-screen flex-col bg-background">
        {/* Top header */}
        <RoomHeader
          onOpenSearch={() => setSearchOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {/* Main content */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left: Player area */}
          <div className="min-w-0 flex-1">
            <AudioPlayer
              onPlay={play}
              onPause={pause}
              onSeek={seek}
              onNext={next}
              onOpenQueue={() => setQueueOpen(true)}
            />
          </div>

          {/* Resize handle */}
          <ResizeHandle
            onResize={handleResize}
            onResizeEnd={handleResizeEnd}
            onDoubleClick={handleDoubleClick}
            collapsed={chatWidth === 0}
          />

          {/* Right: Chat panel */}
          <div
            className="h-full shrink-0 overflow-hidden"
            style={{ width: chatWidth }}
          >
            {chatWidth > 0 && <ChatPanel socket={socket} />}
          </div>
        </div>

        {/* Overlay panels */}
        <SearchDialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          onAddToQueue={handleAddToQueue}
        />
        <QueueDrawer
          open={queueOpen}
          onOpenChange={setQueueOpen}
          onRemoveFromQueue={handleRemoveFromQueue}
          onReorderQueue={handleReorderQueue}
        />
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onUpdateMode={handleUpdateMode}
        />
      </div>
    </InteractionGate>
  )
}
