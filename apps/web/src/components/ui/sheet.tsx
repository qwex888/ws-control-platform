import * as React from 'react'
import { Drawer } from 'vaul'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

const Sheet = Drawer.Root
const SheetTrigger = Drawer.Trigger
const SheetClose = Drawer.Close
const SheetPortal = Drawer.Portal

const SheetOverlay = React.forwardRef<
  React.ComponentRef<typeof Drawer.Overlay>,
  React.ComponentPropsWithoutRef<typeof Drawer.Overlay>
>(({ className, ...props }, ref) => (
  <Drawer.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/60', className)}
    {...props}
  />
))
SheetOverlay.displayName = 'SheetOverlay'

const SheetContent = React.forwardRef<
  React.ComponentRef<typeof Drawer.Content>,
  React.ComponentPropsWithoutRef<typeof Drawer.Content> & { showHandle?: boolean }
>(({ className, children, showHandle = true, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <Drawer.Content
      ref={ref}
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[85vh] flex-col rounded-t-xl border-t bg-background',
        className
      )}
      {...props}
    >
      {showHandle && (
        <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted" />
      )}
      {children}
    </Drawer.Content>
  </SheetPortal>
))
SheetContent.displayName = 'SheetContent'

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center justify-between px-4 py-3', className)} {...props} />
)

const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof Drawer.Title>,
  React.ComponentPropsWithoutRef<typeof Drawer.Title>
>(({ className, ...props }, ref) => (
  <Drawer.Title
    ref={ref}
    className={cn('text-base font-semibold', className)}
    {...props}
  />
))
SheetTitle.displayName = 'SheetTitle'

const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof Drawer.Description>,
  React.ComponentPropsWithoutRef<typeof Drawer.Description>
>(({ className, ...props }, ref) => (
  <Drawer.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
SheetDescription.displayName = 'SheetDescription'

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
}
