import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { defineAbilityFor, type AppAbility } from '@music-together/shared'
import { useRoomStore } from '@/stores/roomStore'

const AbilityContext = createContext<AppAbility>(defineAbilityFor('member'))

export function useAppAbility(): AppAbility {
  return useContext(AbilityContext)
}

export function AbilityProvider({ children }: { children: ReactNode }) {
  const role = useRoomStore((s) => s.currentUser?.role ?? 'member')
  const ability = useMemo(() => defineAbilityFor(role), [role])

  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>
}
