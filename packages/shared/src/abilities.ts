import type { UserRole } from './types.js'

export type Actions =
  | 'play'
  | 'pause'
  | 'seek'
  | 'next'
  | 'prev'
  | 'set-mode'
  | 'add'
  | 'remove'
  | 'reorder'
  | 'manage'
  | 'vote'
  | 'set-role'

export type Subjects = 'Player' | 'Queue' | 'Room' | 'all'

export interface AppAbility {
  can(action: Actions, subject: Subjects): boolean
  cannot(action: Actions, subject: Subjects): boolean
}

type PermissionKey = `${Actions}:${Subjects}`

const ADMIN_PERMISSIONS: ReadonlySet<PermissionKey> = new Set([
  'play:Player',
  'pause:Player',
  'seek:Player',
  'next:Player',
  'prev:Player',
  'set-mode:Player',
  'add:Queue',
  'remove:Queue',
  'reorder:Queue',
])

const MEMBER_PERMISSIONS: ReadonlySet<PermissionKey> = new Set(['add:Queue', 'vote:Player'])

function createAbility(check: (action: Actions, subject: Subjects) => boolean): AppAbility {
  return {
    can: check,
    cannot: (action, subject) => !check(action, subject),
  }
}

const ABILITIES: Record<UserRole, AppAbility> = {
  owner: createAbility(() => true),
  admin: createAbility((action, subject) => ADMIN_PERMISSIONS.has(`${action}:${subject}`)),
  member: createAbility((action, subject) => MEMBER_PERMISSIONS.has(`${action}:${subject}`)),
}

/**
 * Define static RBAC abilities for a given user role.
 *
 * - Owner: manage all (播放控制 + 队列 + 房间设置 + 角色管理 + 投票否决)
 * - Admin: 全部播放控制 + 全部队列权限
 * - Member: 仅添加歌曲 + 发起投票
 */
export function defineAbilityFor(role: UserRole): AppAbility {
  return ABILITIES[role] ?? ABILITIES.member
}
