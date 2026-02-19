import { ActionCards } from '@/components/Lobby/ActionCards'
import { CreateRoomDialog } from '@/components/Lobby/CreateRoomDialog'
import { HeroSection } from '@/components/Lobby/HeroSection'
import { NicknameDialog } from '@/components/Lobby/NicknameDialog'
import { PasswordDialog } from '@/components/Lobby/PasswordDialog'
import { RoomListSection } from '@/components/Lobby/RoomListSection'
import { UserPopover } from '@/components/Lobby/UserPopover'
import { Separator } from '@/components/ui/separator'
import { useLobby } from '@/hooks/useLobby'
import { unlockAudio } from '@/lib/audioUnlock'
import { ACTION_LOADING_TIMEOUT_MS } from '@/lib/constants'
import { storage } from '@/lib/storage'
import { useSocketContext } from '@/providers/SocketProvider'
import { useRoomStore } from '@/stores/roomStore'
import { EVENTS, ERROR_CODE, type RoomListItem, type RoomState } from '@music-together/shared'
import { Github, Headphones } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export default function HomePage() {
  const navigate = useNavigate()
  const { socket } = useSocketContext()
  const { rooms, isLoading, createRoom, joinRoom } = useLobby()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [passwordDialog, setPasswordDialog] = useState<{ open: boolean; room: RoomListItem | null }>({
    open: false,
    room: null,
  })
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const actionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [directRoomId, setDirectRoomId] = useState('')
  const [nicknameDialogOpen, setNicknameDialogOpen] = useState(false)

  // Stores the pending join action while waiting for nickname input
  const pendingJoinRef = useRef<{ type: 'room'; room: RoomListItem } | { type: 'direct'; roomId: string } | null>(null)

  // Refs for onError closure to always read the latest values
  const passwordDialogRef = useRef(passwordDialog)
  passwordDialogRef.current = passwordDialog
  const directRoomIdRef = useRef(directRoomId)
  directRoomIdRef.current = directRoomId
  const lastJoinedRoomIdRef = useRef('')

  const setRoom = useRoomStore((s) => s.setRoom)
  const savedNickname = storage.getNickname()

  // Safety timeout: reset actionLoading after 15s to prevent stuck button
  useEffect(() => {
    if (actionLoading) {
      actionTimeoutRef.current = setTimeout(() => {
        setActionLoading(false)
        toast.error('操作超时，请重试')
      }, ACTION_LOADING_TIMEOUT_MS)
    } else {
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current)
        actionTimeoutRef.current = null
      }
    }
    return () => {
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current)
        actionTimeoutRef.current = null
      }
    }
  }, [actionLoading])

  // Listen for room created / room state events for navigation
  useEffect(() => {
    const onCreated = () => {
      // currentUser will be auto-derived when onState fires and calls setRoom
      setActionLoading(false)
      setCreateDialogOpen(false)
      // Navigation is handled by onState which fires right after onCreated
    }

    const onState = (roomState: RoomState) => {
      // setRoom automatically derives currentUser from room.users
      setRoom(roomState)
      setActionLoading(false)
      setPasswordDialog({ open: false, room: null })
      setPasswordError(null)
      navigate(`/room/${roomState.id}`)
    }

    const onError = (error: { code: string; message: string }) => {
      setActionLoading(false)
      if (error.code === ERROR_CODE.WRONG_PASSWORD) {
        // If password dialog is already open, show error
        if (passwordDialogRef.current.open) {
          setPasswordError('密码错误，请重试')
        } else {
          // Direct join hit a password-protected room — open password dialog
          const targetRoomId = lastJoinedRoomIdRef.current || directRoomIdRef.current.trim()
          if (targetRoomId) {
            setPasswordDialog({
              open: true,
              room: {
                id: targetRoomId,
                name: targetRoomId,
                hasPassword: true,
                userCount: 0,
                currentTrackTitle: null,
                currentTrackArtist: null,
              },
            })
            setPasswordError(null)
          } else {
            toast.error(error.message)
          }
        }
      } else {
        toast.error(error.message)
      }
    }

    socket.on(EVENTS.ROOM_CREATED, onCreated)
    socket.on(EVENTS.ROOM_STATE, onState)
    socket.on(EVENTS.ROOM_ERROR, onError)

    return () => {
      socket.off(EVENTS.ROOM_CREATED, onCreated)
      socket.off(EVENTS.ROOM_STATE, onState)
      socket.off(EVENTS.ROOM_ERROR, onError)
    }
  }, [socket, navigate, setRoom])

  const handleCreateRoom = async (nickname: string, roomName?: string, password?: string) => {
    await unlockAudio()
    storage.setNickname(nickname)
    setActionLoading(true)
    createRoom(nickname, roomName, password)
  }

  const handleRoomClick = async (room: RoomListItem) => {
    if (actionLoading) return
    if (!savedNickname) {
      pendingJoinRef.current = { type: 'room', room }
      setNicknameDialogOpen(true)
      return
    }

    await unlockAudio()

    if (room.hasPassword) {
      setPasswordDialog({ open: true, room })
      setPasswordError(null)
    } else {
      setActionLoading(true)
      joinRoom(room.id, savedNickname)
    }
  }

  const handlePasswordSubmit = (password: string) => {
    if (!passwordDialog.room) return
    if (!savedNickname) return
    setActionLoading(true)
    setPasswordError(null)
    joinRoom(passwordDialog.room.id, savedNickname, password)
  }

  const handleDirectJoin = async () => {
    if (actionLoading) return
    if (!directRoomId.trim()) {
      toast.error('请输入房间号')
      return
    }
    if (!savedNickname) {
      pendingJoinRef.current = { type: 'direct', roomId: directRoomId.trim() }
      setNicknameDialogOpen(true)
      return
    }
    await unlockAudio()
    lastJoinedRoomIdRef.current = directRoomId.trim()
    setActionLoading(true)
    joinRoom(directRoomId.trim(), savedNickname)
  }

  /** Called after the user sets their nickname in NicknameDialog */
  const handleNicknameConfirm = useCallback(
    async (nickname: string) => {
      setNicknameDialogOpen(false)
      const pending = pendingJoinRef.current
      pendingJoinRef.current = null
      if (!pending) return

      await unlockAudio()

      if (pending.type === 'room') {
        const room = pending.room
        if (room.hasPassword) {
          setPasswordDialog({ open: true, room })
          setPasswordError(null)
        } else {
          setActionLoading(true)
          joinRoom(room.id, nickname)
        }
      } else {
        lastJoinedRoomIdRef.current = pending.roomId
        setActionLoading(true)
        joinRoom(pending.roomId, nickname)
      }
    },
    [joinRoom],
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex min-h-screen flex-col bg-background"
    >
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Headphones className="h-5 w-5 text-primary" />
            <span className="text-base font-semibold tracking-tight text-foreground">Music Together</span>
          </div>
          <UserPopover />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <HeroSection />

          <ActionCards
            directRoomId={directRoomId}
            onDirectRoomIdChange={setDirectRoomId}
            onCreateClick={() => setCreateDialogOpen(true)}
            onDirectJoin={handleDirectJoin}
            actionLoading={actionLoading}
          />

          <Separator className="mb-8" />

          <RoomListSection rooms={rooms} isLoading={isLoading} onRoomClick={handleRoomClick} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4">
          <span className="text-xs text-muted-foreground">Music Together · Made by Yueby</span>
          <a
            href="https://github.com/Yueby/music-together"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Github className="h-3.5 w-3.5" />
            GitHub
          </a>
        </div>
      </footer>

      {/* Dialogs */}
      <CreateRoomDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreateRoom={handleCreateRoom}
        defaultNickname={savedNickname}
        isLoading={actionLoading}
      />

      <NicknameDialog
        open={nicknameDialogOpen}
        onOpenChange={setNicknameDialogOpen}
        onConfirm={handleNicknameConfirm}
      />

      <PasswordDialog
        open={passwordDialog.open}
        onOpenChange={(open: boolean) => {
          setPasswordDialog((prev) => ({ ...prev, open }))
          if (!open) setPasswordError(null)
        }}
        roomName={passwordDialog.room?.name ?? ''}
        onSubmit={handlePasswordSubmit}
        error={passwordError}
        isLoading={actionLoading}
      />
    </motion.div>
  )
}
