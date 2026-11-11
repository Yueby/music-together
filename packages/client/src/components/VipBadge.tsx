import { Badge } from '@/components/ui/badge'
import { vipLabel } from '@/lib/platform'
import { cn } from '@/lib/utils'
import type { MusicSource } from '@music-together/shared'
import { Crown } from 'lucide-react'

interface VipBadgeProps {
  platform: MusicSource
  vipType: number | undefined
  className?: string
}

/** Membership badge of a music account. Renders nothing for an account without membership. */
export function VipBadge({ platform, vipType, className }: VipBadgeProps) {
  const label = vipLabel(platform, vipType)
  if (!label) return null
  return (
    <Badge
      className={cn('gap-1 border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400', className)}
      data-testid="vip-badge"
    >
      <Crown aria-hidden className="size-3" />
      {label}
    </Badge>
  )
}
