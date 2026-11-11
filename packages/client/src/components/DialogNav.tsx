import { Button } from '@/components/ui/button'
import {
  DIALOG_BAR_CLASS,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { cn } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'

/** Width of the back button's slot: the button (size-8) and a little space after it. */
const BACK_SLOT = 36
const SLOT_TRANSITION = { duration: 0.2, ease: 'easeOut' } as const

interface DialogNavBarProps {
  /** The title of the page being shown. A change fades the new one in. */
  title: string
  /** Read out for screen readers (the bar has no room for visible subtitles). */
  description: string
  /** Given on a page that was entered from another: the back button appears left of the title, which makes way for it. */
  onBack?: () => void
  /** Controls on the right of the bar (a platform picker, an account menu). */
  children?: ReactNode
}

/**
 * The title bar of a dialog that can go into pages: `[← ] Title ........ controls`. The back button slides in on the
 * left and pushes the title along instead of the title jumping; on the first page there is no button and no gap.
 */
export function DialogNavBar({ title, description, onBack, children }: DialogNavBarProps) {
  return (
    <ResponsiveDialogHeader className={cn(DIALOG_BAR_CLASS, 'justify-between')}>
      <div className="flex min-w-0 items-center">
        <AnimatePresence initial={false}>
          {onBack ? (
            <motion.div
              key="back"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: BACK_SLOT, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={SLOT_TRANSITION}
              className="shrink-0 overflow-hidden"
            >
              <Button variant="ghost" size="icon" className="size-8" onClick={onBack} aria-label="返回">
                <ArrowLeft className="size-4" />
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <ResponsiveDialogTitle
          key={title}
          className="animate-in fade-in-0 min-w-0 truncate duration-200 motion-reduce:animate-none"
        >
          {title}
        </ResponsiveDialogTitle>
      </div>
      <ResponsiveDialogDescription className="sr-only">{description}</ResponsiveDialogDescription>
      {children}
    </ResponsiveDialogHeader>
  )
}

/**
 * Holds the page a dialog is showing: going into another page (or back) fades the old one out and the new one in. Give
 * each page its own `pageKey`; the area fills the dialog body like the page itself would.
 */
export function DialogPageTransition({ pageKey, children }: { pageKey: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pageKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
