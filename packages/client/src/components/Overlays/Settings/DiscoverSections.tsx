import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { DiscoverError } from '@/hooks/useDiscover'
import { PLATFORM_LABELS } from '@/lib/platform'
import type { MusicSource } from '@music-together/shared'
import { RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { CoverCard, CoverGrid } from '../CoverCard'

/** What to tell the user instead of a block. Explicit, so an empty block never looks like a bug. */
export function messageFor(error: DiscoverError, platform: MusicSource, feature: string): string {
  const name = PLATFORM_LABELS[platform]
  if (error === 'unsupported') return `${name}暂不提供${feature}`
  if (error === 'login-required') return `登录${name}后查看${feature}`
  return `${feature}加载失败`
}

/** One titled block of the account page. */
export function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold sm:text-lg">{title}</h3>
          {subtitle ? <p className="text-muted-foreground mt-0.5 truncate text-xs">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function GridSkeleton({ count = 6, round }: { count?: number; round?: boolean }) {
  return (
    <CoverGrid>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-2 p-2">
          <Skeleton className={round ? 'aspect-square w-full rounded-full' : 'aspect-square w-full rounded-lg'} />
          <Skeleton className="mx-auto h-3.5 w-3/4" />
        </div>
      ))}
    </CoverGrid>
  )
}

/** A block's note: why it shows nothing, with a retry only where trying again can help. */
export function Note({ children, onRetry }: { children: string; onRetry?: () => void }) {
  return (
    <Card className="gap-0 border-dashed py-0 shadow-none">
      <CardContent className="text-muted-foreground flex flex-wrap items-center gap-3 px-4 py-6 text-sm">
        <span>{children}</span>
        {onRetry ? (
          <Button variant="outline" size="sm" className="min-h-11 sm:min-h-8" onClick={onRetry}>
            <RefreshCw />
            重试
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

interface CoverSectionProps<T extends { id: string }> {
  platform: MusicSource
  title: string
  subtitle?: string
  items: T[]
  loading: boolean
  error: DiscoverError | null
  onRetry: () => void
  describe: (item: T) => { title: string; subtitle?: string; cover?: string }
  fallback: ReactNode
  round?: boolean
  onSelect: (item: T) => void
}

/** A block of cover tiles (playlists, artists, albums) with its loading, empty and failed states. */
export function CoverSection<T extends { id: string }>({
  platform,
  title,
  subtitle,
  items,
  loading,
  error,
  onRetry,
  describe,
  fallback,
  round,
  onSelect,
}: CoverSectionProps<T>) {
  // A failure is reported even next to tiles that did load (the block is incomplete, not empty).
  const problem = error ? (
    <Note onRetry={error === 'failed' ? onRetry : undefined}>{messageFor(error, platform, title)}</Note>
  ) : null
  let body: ReactNode
  if (items.length === 0) {
    body = problem ?? (loading ? <GridSkeleton round={round} /> : <Note>暂无内容</Note>)
  } else {
    body = (
      <>
        <CoverGrid>
          {items.map((item) => {
            const view = describe(item)
            return (
              <CoverCard
                key={item.id}
                title={view.title}
                subtitle={view.subtitle}
                cover={view.cover}
                fallback={fallback}
                round={round}
                onClick={() => onSelect(item)}
              />
            )
          })}
        </CoverGrid>
        {problem}
      </>
    )
  }
  return (
    <Section title={title} subtitle={subtitle}>
      {body}
    </Section>
  )
}
