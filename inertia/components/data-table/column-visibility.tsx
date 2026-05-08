import { Columns3Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type ColumnDef = {
  key: string
  label: string
  /** If true, the column cannot be hidden. */
  required?: boolean
}

type ColumnVisibilityMenuProps = {
  columns: ColumnDef[]
  isVisible: (key: string) => boolean
  onToggle: (key: string) => void
  onReset?: () => void
  label?: string
  /** When true, render only an icon trigger (for use inside a table header cell). */
  compact?: boolean
}

export function ColumnVisibilityMenu({
  columns,
  isVisible,
  onToggle,
  onReset,
  label = 'Columns',
  compact = false,
}: ColumnVisibilityMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <Button variant="ghost" size="icon" aria-label="Toggle columns" className="size-7">
            <Columns3Icon className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Columns3Icon />
            {label}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.key}
            checked={isVisible(c.key)}
            disabled={c.required}
            onSelect={(e) => {
              e.preventDefault()
              if (!c.required) onToggle(c.key)
            }}
          >
            {c.label}
          </DropdownMenuCheckboxItem>
        ))}
        {onReset ? (
          <>
            <DropdownMenuSeparator />
            <button
              type="button"
              onClick={onReset}
              className="w-full rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Reset to default
            </button>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
