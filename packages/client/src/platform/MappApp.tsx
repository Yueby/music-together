import type { MappHost } from '../../../mapp/src/compat/MappHost'
import { ROOM_ID_PATTERN } from '@music-together/shared'
import { useCallback } from 'react'
import { MemoryRouter, useNavigate } from 'react-router'
import { hostRuntime } from '@/lib/hostRuntime'
import { resetAllRoomState } from '@/lib/resetStores'
import { MappSocketProvider } from '@/providers/MappSocketProvider'
import { AppSurface } from '@/App'

export interface MappAppProps {
  host: MappHost
  initialRoomId?: string
}

function resolveInitialPath(roomId?: string): string {
  if (roomId && ROOM_ID_PATTERN.test(roomId)) {
    return `/room/${roomId}`
  }
  return '/'
}

function MappAppSurface({ host }: { host: MappHost }) {
  const navigate = useNavigate()

  const handleReset = useCallback(() => {
    host.roomCommands.leave(host.session.socket)
    resetAllRoomState()
    navigate('/', { replace: true })
  }, [host, navigate])

  return <AppSurface onReset={handleReset} />
}

export function MappApp({ host, initialRoomId }: MappAppProps) {
  if (hostRuntime.kind !== 'mapp') {
    throw new Error('MAPP_BINDINGS_REQUIRED')
  }

  const initialPath = resolveInitialPath(initialRoomId)

  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <MappSocketProvider session={host.session}>
        <MappAppSurface host={host} />
      </MappSocketProvider>
    </MemoryRouter>
  )
}

export default MappApp
