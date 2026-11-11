import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/** An icon and a line of text in the middle of the box it fills: "nothing here yet" in lists and result areas. */
export function EmptyState({ icon, message, className }: { icon: ReactNode; message: string; className?: string }) {
  return (
    <div
      className={cn(
        'text-muted-foreground flex h-full min-h-48 flex-col items-center justify-center gap-2 px-4 text-center',
        className,
      )}
    >
      {icon}
      <span className="text-sm">{message}</span>
    </div>
  )
}
