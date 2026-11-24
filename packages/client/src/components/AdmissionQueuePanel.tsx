import { Button } from '@/components/ui/button'
import {
  DIALOG_BAR_CLASS,
  DIALOG_BODY_CLASS,
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { AdmissionQueuedEvent } from '@music-together/shared'
import { Clock, DoorOpen, PlusCircle } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { getEffectiveServerLoad } from './ServerLoadBadge'

interface AdmissionQueueContentProps {
  queued: AdmissionQueuedEvent
  onCancel: () => void
  cancelLabel?: string
}

const queueTitles: Record<AdmissionQueuedEvent['reason'], string> = {
  capacity: '服务器满载，正在排队',
  mapp_stream: '音频中转繁忙，正在排队',
  mapp_room: '房间音频中转繁忙，正在排队',
}

function QueueBody({ queued }: { queued: AdmissionQueuedEvent }) {
  const prefersReducedMotion = useReducedMotion()
  const isMappStream = queued.reason === 'mapp_stream'
  const isMappRoom = queued.reason === 'mapp_room'
  const isMappRelayQueue = isMappStream || isMappRoom
  const isCreate = queued.action === 'create'
  const pct = isMappRelayQueue
    ? Math.min(100, Math.max(0, queued.capacity.mappPressurePercent ?? queued.capacity.pressurePercent))
    : getEffectiveServerLoad(queued.capacity).pct
  const hint = isMappRoom
    ? `目标房间微应用听众较多（上限 ${queued.capacity.mappRoomLimit} 人），有人离开后会自动为你进入，请保持页面开启。`
    : isMappStream
      ? '音频中转有空位后会自动为你进入，请保持页面开启。'
      : '有空位后会自动为你进入，请保持当前页面开启。'
  const aheadCount = Math.max(0, queued.position - 1)
  const isNextInLine = queued.position <= 1

  const loadBarClass = pct >= 85 ? 'bg-destructive' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
  const loadTextClass = pct >= 85 ? 'text-destructive' : pct >= 60 ? 'text-amber-400' : 'text-emerald-400'

  return (
    <div className="space-y-4">
      {/* Position spotlight */}
      <div className="rounded-xl border border-border bg-secondary/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-2" role="status" aria-live="polite">
            <p className="flex items-baseline text-2xl font-semibold tracking-tight text-foreground tabular-nums">
              <span className="whitespace-pre">第 </span>
              <span className="relative inline-flex overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={queued.position}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
                    className="inline-block"
                  >
                    {queued.position}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="whitespace-pre"> 位</span>
            </p>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">共 {queued.queueLength} 人</span>
          </div>

          {isNextInLine ? (
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              你是下一位
            </span>
          ) : (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">前方 {aheadCount} 人</span>
          )}
        </div>

        <Separator className="my-3" />

        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="flex min-w-0 items-center gap-1.5 text-foreground/85">
            {isCreate ? (
              <PlusCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <DoorOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{isCreate ? '创建新房间' : '加入房间'}</span>
          </span>
          {!isCreate && queued.roomId && (
            <span className="shrink-0 rounded bg-background/70 px-1.5 py-0.5 font-mono text-xs text-foreground">
              {queued.roomId}
            </span>
          )}
        </div>
      </div>

      {/* Live load bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="min-w-0 truncate text-muted-foreground">
            {isMappRelayQueue ? '音频中转负载' : '服务器负载'}
          </span>
          <span className={cn('shrink-0 font-medium tabular-nums', loadTextClass)}>{pct}%</span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <motion.div
            className={cn('h-full rounded-full', loadBarClass)}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.35, ease: 'easeOut' }}
          />
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      </div>
    </div>
  )
}

/** Modal / bottom drawer shown on the lobby page while waiting in the admission queue. */
export function AdmissionQueueDialog({ queued, onCancel, cancelLabel = '取消排队' }: AdmissionQueueContentProps) {
  const titleText = queueTitles[queued.reason]

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <ResponsiveDialogContent aria-describedby={undefined} className="gap-0 p-0 sm:max-w-md">
        <ResponsiveDialogHeader className={DIALOG_BAR_CLASS}>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-400" />
            {titleText}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className={cn(DIALOG_BODY_CLASS, 'space-y-4')}>
          <QueueBody queued={queued} />

          <Button variant="outline" size="lg" onClick={onCancel} className="min-h-11 w-full sm:min-h-0">
            {cancelLabel}
          </Button>
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

/** Full-viewport centered card shown on RoomPage when opening a direct room link while queued. */
export function AdmissionQueueCard({ queued, onCancel, cancelLabel = '取消并返回大厅' }: AdmissionQueueContentProps) {
  const prefersReducedMotion = useReducedMotion()
  const titleText = queueTitles[queued.reason]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background px-4">
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 25 }}
        className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-amber-400">
            <Clock className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">{titleText}</h1>
        </div>

        <QueueBody queued={queued} />

        <Button variant="outline" size="lg" onClick={onCancel} className="min-h-11 w-full sm:min-h-0">
          {cancelLabel}
        </Button>
      </motion.div>
    </div>
  )
}
