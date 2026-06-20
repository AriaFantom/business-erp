import { type PropsWithChildren, useEffect, useState } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { LogOut, Maximize, Minimize, Store } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggle } from '@/components/theme-toggle'

import DefaultLayout from './default'

/**
 * Full-screen, sidebar-less shell for the point-of-sale register. Composes with
 * DefaultLayout so flash toasts keep working, but fills the whole viewport and
 * offers a browser-fullscreen toggle and an explicit exit back to the dashboard.
 */
function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void document.documentElement.requestFullscreen()
    }
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle fullscreen">
      {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
    </Button>
  )
}

export default function PosLayout({ children }: PropsWithChildren) {
  return (
    <DefaultLayout>
      <ThemeProvider>
        <TooltipProvider delayDuration={0}>
          <div className="flex h-screen flex-col overflow-hidden bg-background">
            <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Store className="size-4" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold">Point of Sale</span>
                <span className="text-xs text-muted-foreground">LayerDreams</span>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <FullscreenButton />
                <ThemeToggle />
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard">
                    <LogOut className="size-4" />
                    Exit POS
                  </Link>
                </Button>
              </div>
            </header>
            <div className="flex-1 overflow-hidden">{children}</div>
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </DefaultLayout>
  )
}
