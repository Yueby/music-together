import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Music, Users, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { connectSocket } from '@/lib/socket'
import { unlockAudio } from '@/lib/audioUnlock'
import { EVENTS } from '@music-together/shared'
import { useRoomStore } from '@/stores/roomStore'

export default function HomePage() {
  const [nickname, setNickname] = useState(() => localStorage.getItem('mt-nickname') || '')
  const [roomId, setRoomId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const setCurrentUser = useRoomStore((s) => s.setCurrentUser)

  const handleCreate = async () => {
    if (!nickname.trim()) {
      toast.error('请输入昵称')
      return
    }
    setIsLoading(true)

    // Unlock audio on this trusted user interaction
    await unlockAudio()

    const socket = connectSocket()

    socket.once(EVENTS.ROOM_CREATED, (data: { roomId: string; userId: string }) => {
      localStorage.setItem('mt-nickname', nickname.trim())
      setCurrentUser({ id: data.userId, nickname: nickname.trim(), isHost: true })
      setIsLoading(false)
      navigate(`/room/${data.roomId}`)
    })

    socket.once(EVENTS.ROOM_ERROR, (error: { message: string }) => {
      toast.error(error.message)
      setIsLoading(false)
    })

    socket.emit(EVENTS.ROOM_CREATE, { nickname: nickname.trim() })
  }

  const handleJoin = async () => {
    if (!nickname.trim()) {
      toast.error('请输入昵称')
      return
    }
    if (!roomId.trim()) {
      toast.error('请输入房间号')
      return
    }
    setIsLoading(true)

    // Unlock audio on this trusted user interaction
    await unlockAudio()

    const socket = connectSocket()

    socket.once(EVENTS.ROOM_STATE, () => {
      localStorage.setItem('mt-nickname', nickname.trim())
      setCurrentUser({ id: socket.id ?? '', nickname: nickname.trim(), isHost: false })
      setIsLoading(false)
      navigate(`/room/${roomId.trim()}`)
    })

    socket.once(EVENTS.ROOM_ERROR, (error: { message: string }) => {
      toast.error(error.message)
      setIsLoading(false)
    })

    socket.emit(EVENTS.ROOM_JOIN, { roomId: roomId.trim(), nickname: nickname.trim() })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo & Title */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Music className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Music Together</h1>
          <p className="text-muted-foreground">和朋友一起听歌，实时同步</p>
        </div>

        {/* Nickname input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">你的昵称</label>
          <Input
            placeholder="输入昵称..."
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </div>

        {/* Create Room */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Music className="h-5 w-5" />
              创建房间
            </CardTitle>
            <CardDescription>创建一个新的听歌房间，邀请朋友加入</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              size="lg"
              onClick={handleCreate}
              disabled={isLoading}
            >
              创建房间
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Join Room */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              加入房间
            </CardTitle>
            <CardDescription>输入房间号，加入朋友的听歌房间</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="输入房间号..."
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <Button
              className="w-full"
              size="lg"
              variant="secondary"
              onClick={handleJoin}
              disabled={isLoading}
            >
              加入房间
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
