import { Music } from 'lucide-react'
import { motion } from 'motion/react'
import type { RoomListItem } from '@music-together/shared'
import { RoomCard } from './RoomCard'
import { Skeleton } from '@/components/ui/skeleton'

interface RoomListSectionProps {
  rooms: RoomListItem[]
  isLoading: boolean
  onRoomClick: (room: RoomListItem) => void
}

export function RoomListSection({ rooms, isLoading, onRoomClick }: RoomListSectionProps) {
  return (
    <>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
              <div className="space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
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
              onClick={() => onRoomClick(room)}
            />
          ))}
        </div>
      )}
    </>
  )
}
