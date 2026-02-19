import * as React from 'react'

import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'

// ---------------------------------------------------------------------------
// Context — shares isMobile state with sub-components
// ---------------------------------------------------------------------------

const ResponsiveDialogContext = React.createContext(false)

function useIsResponsiveMobile() {
  return React.useContext(ResponsiveDialogContext)
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

function ResponsiveDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  const isMobile = useIsMobile()

  return (
    <ResponsiveDialogContext.Provider value={isMobile}>
      {isMobile ? (
        <Drawer open={open} onOpenChange={onOpenChange}>
          {children}
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      )}
    </ResponsiveDialogContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function ResponsiveDialogContent({
  className,
  children,
  showCloseButton,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  const isMobile = useIsResponsiveMobile()

  if (isMobile) {
    return <DrawerContent className={className}>{children}</DrawerContent>
  }

  return (
    <DialogContent className={className} showCloseButton={showCloseButton} {...props}>
      {children}
    </DialogContent>
  )
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function ResponsiveDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  const isMobile = useIsResponsiveMobile()
  return isMobile ? (
    <DrawerHeader className={cn('text-left', className)} {...props} />
  ) : (
    <DialogHeader className={className} {...props} />
  )
}

// ---------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------

function ResponsiveDialogTitle({ className, ...props }: React.ComponentProps<typeof DialogTitle>) {
  const isMobile = useIsResponsiveMobile()
  return isMobile ? <DrawerTitle className={className} {...props} /> : <DialogTitle className={className} {...props} />
}

// ---------------------------------------------------------------------------
// Description
// ---------------------------------------------------------------------------

function ResponsiveDialogDescription({ className, ...props }: React.ComponentProps<typeof DialogDescription>) {
  const isMobile = useIsResponsiveMobile()
  return isMobile ? (
    <DrawerDescription className={className} {...props} />
  ) : (
    <DialogDescription className={className} {...props} />
  )
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function ResponsiveDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  const isMobile = useIsResponsiveMobile()
  return isMobile ? (
    <DrawerFooter className={className} {...props} />
  ) : (
    <DialogFooter className={className} {...props} />
  )
}

// ---------------------------------------------------------------------------
// Close
// ---------------------------------------------------------------------------

function ResponsiveDialogClose(props: React.ComponentProps<typeof DialogClose>) {
  const isMobile = useIsResponsiveMobile()
  return isMobile ? <DrawerClose {...props} /> : <DialogClose {...props} />
}

// ---------------------------------------------------------------------------
// Body — provides horizontal padding in Drawer mode so body content aligns
// with DrawerHeader (p-4). In Dialog mode it's a transparent wrapper since
// DialogContent already supplies p-6.
// ---------------------------------------------------------------------------

function ResponsiveDialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  const isMobile = useIsResponsiveMobile()
  return <div className={cn(isMobile && 'overflow-y-auto px-4 pb-4', className)} {...props} />
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  useIsResponsiveMobile,
}
