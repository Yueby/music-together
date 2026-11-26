import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Native overflow scroll container.
 * Uses the app's CSS scrollbar rules instead of Radix ScrollArea, which injects runtime `<style>` tags
 * that trigger CSP `style-src` violations in strict mini-app sandboxes.
 */
function ScrollArea({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="scroll-area"
      className={cn(
        'focus-visible:ring-ring/50 relative overflow-y-auto outline-none focus-visible:ring-[3px] focus-visible:outline-1',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function ScrollBar() {
  return null
}

export { ScrollArea, ScrollBar }
