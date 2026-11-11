import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Shows or hides its content by growing and shrinking its height, instead of popping in. The content stays mounted
 * (its state is kept) and, while hidden, is `inert`: not focusable, not read out. The space for the 3px focus ring of the
 * controls inside is part of the clipped area.
 */
function Collapse({
  open,
  className,
  children,
  ...props
}: { open: boolean } & Omit<React.ComponentProps<'div'>, 'inert'>) {
  return (
    <div
      data-slot="collapse"
      data-state={open ? 'open' : 'closed'}
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        className,
      )}
      inert={!open}
      {...props}
    >
      <div className="-mx-1 -mb-1 min-h-0 overflow-hidden px-1 pb-1">{children}</div>
    </div>
  )
}

export { Collapse }
