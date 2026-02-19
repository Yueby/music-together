import { memo } from 'react'
import { Lock, LockOpen, Music, Users } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { RoomListItem } from '@music-together/shared'
import { cn } from '@/lib/utils'

interface RoomCardProps {
  room: RoomListItem
  index: number
  onClick: () => void
}

export const RoomCard = memo(function RoomCard({ room, index, onClick }: RoomCardProps) {
  const prefersReducedMotion = useReducedMotion()
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'group relative flex w-full flex-col gap-3 overflow-hidden rounded-xl p-5 text-left',
        'border border-border bg-card transition-all duration-300',
        'hover:shadow-md hover:border-primary/20',
      )}
    >
      {/* Room name row */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">{room.name}</h3>
          {room.currentTrackTitle && (
            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <Music className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate">
                {room.currentTrackTitle}
                {room.currentTrackArtist && ` - ${room.currentTrackArtist}`}
              </span>
            </p>
          )}
        </div>

        {/* Right side: playing animation + lock icon */}
        <div className="ml-3 flex shrink-0 items-center gap-2">
          {/* Subtle playing animation for rooms with active tracks */}
          {room.currentTrackTitle && (
            <div className="flex items-end gap-0.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-0.5 rounded-full bg-primary/40"
                  animate={prefersReducedMotion ? { height: 8 } : { height: [4, 12, 6, 10, 4] }}
                  transition={
                    prefersReducedMotion
                      ? {}
                      : {
                          duration: 1.2,
                          repeat: Infinity,
                          delay: i * 0.15,
                          ease: 'easeInOut',
                        }
                  }
                />
              ))}
            </div>
          )}
          {room.hasPassword ? (
            <Lock className="h-4 w-4 text-muted-foreground/60" />
          ) : (
            <LockOpen className="h-4 w-4 text-muted-foreground/40" />
          )}
        </div>
      </div>

      {/* Bottom info */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          {room.userCount}
        </span>
        <span className="text-xs text-muted-foreground/50">{room.id}</span>
      </div>
    </motion.button>
  )
})
