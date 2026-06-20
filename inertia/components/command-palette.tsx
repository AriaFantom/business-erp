import { useEffect, useState } from 'react'
import { router, usePage } from '@inertiajs/react'

import { Button } from '@/components/ui/button'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { visibleNavLinks, type SidebarUser } from '@/lib/nav'
import type { Data } from '@generated/data'
import { Search } from 'lucide-react'

/**
 * Global quick-jump palette (⌘K / Ctrl-K). Lists permission-visible nav links
 * grouped by section and navigates on select. Client-side only — no backend.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const { user } = usePage<Data.SharedProps>().props as unknown as {
    user: SidebarUser | undefined
  }
  const links = visibleNavLinks(user)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const go = (url: string) => {
    setOpen(false)
    router.visit(url)
  }

  // Group links by section (loose links sit under "Go to").
  const groups = new Map<string, typeof links>()
  for (const link of links) {
    const key = link.section ?? 'Go to'
    const arr = groups.get(key) ?? []
    arr.push(link)
    groups.set(key, arr)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="ml-1 hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Quick navigation">
        <CommandInput placeholder="Jump to a page…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {[...groups.entries()].map(([section, items]) => (
            <CommandGroup key={section} heading={section}>
              {items.map((link) => (
                <CommandItem
                  key={link.url}
                  value={`${section} ${link.title}`}
                  onSelect={() => go(link.url)}
                >
                  <link.icon />
                  <span>{link.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  )
}
