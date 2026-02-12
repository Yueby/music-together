import { CreateRoomDialog } from '@/components/Lobby/CreateRoomDialog'
import { NicknameDialog } from '@/components/Lobby/NicknameDialog'
import { PasswordDialog } from '@/components/Lobby/PasswordDialog'
import { RoomCard } from '@/components/Lobby/RoomCard'
import { UserPopover } from '@/components/Lobby/UserPopover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useLobby } from '@/hooks/useLobby'
import { unlockAudio } from '@/lib/audioUnlock'
import { storage } from '@/lib/storage'
import { useSocketContext } from '@/providers/SocketProvider'
import { useRoomStore } from '@/stores/roomStore'
import { EVENTS, type RoomListItem } from '@music-together/shared'
import { Github, Headphones, Home, LogIn, Music } from 'lucide-react'
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

  const setCurrentUser = useRoomStore((s) => s.setCurrentUser)
  const savedNickname = storage.getNickname()

  // Safety timeout: reset actionLoading after 15s to prevent stuck button
  useEffect(() => {
    if (actionLoading) {
      actionTimeoutRef.current = setTimeout(() => {
        setActionLoading(false)
        toast.error('操作超时，请重试')
      }, 15_000)
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
    const onCreated = (data: { roomId: string; userId: string }) => {
      const nickname = storage.getNickname()
      setCurrentUser({ id: data.userId, nickname, isHost: true })
      setActionLoading(false)
      setCreateDialogOpen(false)
      navigate(`/room/${data.roomId}`)
    }

    const onState = (roomState: { id: string }) => {
      setActionLoading(false)
      setPasswordDialog({ open: false, room: null })
      setPasswordError(null)
      navigate(`/room/${roomState.id}`)
    }

    const onError = (error: { code: string; message: string }) => {
      setActionLoading(false)
      if (error.code === 'WRONG_PASSWORD') {
        setPasswordError('密码错误，请重试')
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
  }, [socket, navigate, setCurrentUser])

  const handleCreateRoom = async (nickname: string, roomName?: string, password?: string) => {
    await unlockAudio()
    storage.setNickname(nickname)
    setActionLoading(true)
    createRoom(nickname, roomName, password)
  }

  const handleRoomClick = async (room: RoomListItem) => {
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
    const nickname = savedNickname || 'Guest'
    setActionLoading(true)
    setPasswordError(null)
    joinRoom(passwordDialog.room.id, nickname, password)
  }

  const handleDirectJoin = async () => {
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
    setActionLoading(true)
    joinRoom(directRoomId.trim(), savedNickname)
  }

  /** Called after the user sets their nickname in NicknameDialog */
  const handleNicknameConfirm = useCallback(async (nickname: string) => {
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
      setActionLoading(true)
      joinRoom(pending.roomId, nickname)
    }
  }, [joinRoom])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── Header ── */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Headphones className="h-5 w-5 text-primary" />
            <span className="text-base font-semibold tracking-tight text-foreground">
              Music Together
            </span>
          </div>
          <UserPopover />
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8">
          {/* Hero text */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 text-center"
          >
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              和朋友一起听歌
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              创建或加入一个房间，实时同步音乐播放
            </p>
          </motion.div>

          {/* Action cards */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mb-10 grid gap-4 sm:grid-cols-2"
          >
            {/* Create room card */}
            <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5">
              <div className="mb-4">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Home className="h-4 w-4 text-primary" />
                  </div>
                  <h2 className="text-base font-semibold text-foreground">创建房间</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  新建一个房间，分享房间号邀请朋友加入
                </p>
              </div>
              <Button onClick={() => setCreateDialogOpen(true)} className="w-full">
                <Home className="mr-2 h-4 w-4" />
                创建房间
              </Button>
            </div>

            {/* Join room card */}
            <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5">
              <div className="mb-4">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <LogIn className="h-4 w-4 text-primary" />
                  </div>
                  <h2 className="text-base font-semibold text-foreground">加入房间</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  输入房间号直接加入已有房间
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="输入房间号..."
                  value={directRoomId}
                  onChange={(e) => setDirectRoomId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDirectJoin()}
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  onClick={handleDirectJoin}
                  disabled={actionLoading}
                >
                  加入
                </Button>
              </div>
            </div>
          </motion.div>

          <Separator className="mb-8" />

          {/* Room list */}
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground/80">
              活跃房间
              {!isLoading && rooms.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({rooms.length})
                </span>
              )}
            </h2>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <motion.div
                className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          ) : rooms.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/50 px-8 py-16 text-center"
            >
              <Music className="h-10 w-10 text-muted-foreground/25" />
              <div>
                <p className="text-base font-medium text-foreground/60">还没有活跃的房间</p>
                <p className="mt-1 text-sm text-muted-foreground">创建一个房间，邀请朋友一起听歌</p>
              </div>
            </motion.div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room, i) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  index={i}
                  onClick={() => handleRoomClick(room)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="text-xs text-muted-foreground">
            Music Together · Made by Yueby
          </span>
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

      {/* ── Dialogs ── */}
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
        onOpenChange={(open) => {
          setPasswordDialog({ ...passwordDialog, open })
          if (!open) setPasswordError(null)
        }}
        roomName={passwordDialog.room?.name ?? ''}
        onSubmit={handlePasswordSubmit}
        error={passwordError}
        isLoading={actionLoading}
      />
    </div>
  )
}
