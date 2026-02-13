import { PureAbility, AbilityBuilder } from '@casl/ability'
import type { UserRole } from './types.js'

export type Actions =
  | 'play' | 'pause' | 'seek' | 'next' | 'prev'
  | 'add' | 'remove' | 'reorder'
  | 'manage' | 'vote' | 'set-role'

export type Subjects = 'Player' | 'Queue' | 'Room' | 'all'

export type AppAbility = PureAbility<[Actions, Subjects]>

/**
 * Define CASL abilities for a given user role.
 *
 * - Host: manage all (播放控制 + 队列 + 房间设置 + 角色管理 + 投票否决)
 * - Admin: 全部播放控制 + 全部队列权限
 * - Member: 仅添加歌曲 + 发起投票
 */
export function defineAbilityFor(role: UserRole): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(PureAbility)

  switch (role) {
    case 'host':
      can('manage', 'all')
      break
    case 'admin':
      can('play', 'Player')
      can('pause', 'Player')
      can('seek', 'Player')
      can('next', 'Player')
      can('prev', 'Player')
      can('add', 'Queue')
      can('remove', 'Queue')
      can('reorder', 'Queue')
      break
    case 'member':
      can('add', 'Queue')
      can('vote', 'Player')
      break
  }

  return build()
}
