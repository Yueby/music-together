import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useRoomStore } from '@/stores/roomStore'
import type { UserRole } from '@music-together/shared'
import { Crown, Shield, User } from 'lucide-react'

interface MembersSectionProps {
  onSetUserRole?: (userId: string, role: 'admin' | 'member') => void
}

const ROLE_LABELS: Record<UserRole, string> = {
  owner: '房主',
  admin: '管理员',
  member: '成员',
}

const ROLE_ORDER: Record<string, number> = { owner: 0, admin: 1, member: 2 }

function getRoleIcon(role: UserRole) {
  switch (role) {
    case 'owner':
      return <Crown className="h-4 w-4 text-yellow-500" />
    case 'admin':
      return <Shield className="h-4 w-4 text-blue-400" />
    case 'member':
      return <User className="h-4 w-4 text-muted-foreground" />
  }
}

export function MembersSection({ onSetUserRole }: MembersSectionProps) {
  const room = useRoomStore((s) => s.room)
  const currentUser = useRoomStore((s) => s.currentUser)
  const isOwner = currentUser?.role === 'owner'

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">在线成员 ({room?.users.length ?? 0})</h3>
        <Separator className="mt-2 mb-4" />

        <div className="space-y-1">
          {[...(room?.users ?? [])]
            .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9))
            .map((user) => {
              const canChangeRole = Boolean(
                isOwner && user.role !== 'owner' && user.id !== currentUser?.id && onSetUserRole,
              )
              return (
                <div key={user.id} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 sm:px-3">
                  <span className="shrink-0">{getRoleIcon(user.role)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{user.nickname}</span>
                  {user.id === currentUser?.id && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      你
                    </Badge>
                  )}

                  {/* Owner can change other users' roles (Select replaces the redundant static role badge) */}
                  {canChangeRole ? (
                    <Select
                      value={user.role}
                      onValueChange={(v) => onSetUserRole!(user.id, v as 'admin' | 'member')}
                    >
                      <SelectTrigger className="h-8 w-24 shrink-0 text-xs sm:h-7" aria-label={`更改 ${user.nickname} 的角色`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">管理员</SelectItem>
                        <SelectItem value="member">成员</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  )}
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
