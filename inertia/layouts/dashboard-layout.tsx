import type { PropsWithChildren } from 'react'

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppSidebar } from '@/components/app-sidebar'

import DefaultLayout from './default'

/**
 * Wraps an authenticated page with the persistent sidebar shell.
 *
 * Composes with the global DefaultLayout so flash toasts continue to work on
 * every authenticated page. Pages opt in via Inertia's persistent-layout
 * pattern: `Page.layout = (p) => <DashboardLayout>{p}</DashboardLayout>`.
 */
export default function DashboardLayout({ children }: PropsWithChildren) {
  return (
    <DefaultLayout>
      <TooltipProvider delayDuration={0}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
            </header>
            <div className="flex-1">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </DefaultLayout>
  )
}
