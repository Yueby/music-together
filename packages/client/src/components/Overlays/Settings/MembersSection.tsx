import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useRoomStore } from '@/stores/roomStore'
import type { UserRole } from '@music-together/shared'
import { Crown, Shield, User } from 'lucide-react'

interface MembersSectionProps {
  onSetUserRole?: (userId: string, role: 'admin' | 'member') => void
}

const ROLE_LABELS: Record<UserRole, string> = {
  host: '房主',
  admin: '管理员',
  member: '成员',
}

function getRoleIcon(role: UserRole) {
  switch (role) {
    case 'host': return <Crown className="h-4 w-4 text-yellow-500" />
    case 'admin': return <Shield className="h-4 w-4 text-blue-400" />
    case 'member': return <User className="h-4 w-4 text-muted-foreground" />
  }
}

export function MembersSection({ onSetUserRole }: MembersSectionProps) {
  const room = useRoomStore((s) => s.room)
  const currentUser = useRoomStore((s) => s.currentUser)
  const isHost = currentUser?.role === 'host'

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">
          在线成员 ({room?.users.length ?? 0})
        </h3>
        <Separator className="mt-2 mb-4" />

        <div className="space-y-1">
          {room?.users.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5"
            >
              {getRoleIcon(user.role)}
              <span className="text-sm">{user.nickname}</span>
              {user.id === currentUser?.id && (
                <Badge variant="secondary" className="text-xs">
                  你
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {ROLE_LABELS[user.role]}
              </Badge>

              {/* Host can change other users' roles (not their own) */}
              {isHost && user.role !== 'host' && user.id !== currentUser?.id && onSetUserRole && (
                <Select
                  value={user.role}
                  onValueChange={(v) => onSetUserRole(user.id, v as 'admin' | 'member')}
                >
                  <SelectTrigger className="ml-auto h-7 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">管理员</SelectItem>
                    <SelectItem value="member">成员</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
