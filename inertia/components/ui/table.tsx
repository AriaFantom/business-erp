import * as React from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type TableProps = React.ComponentProps<'table'> & {
  filterable?: boolean
  filterPlaceholder?: string
}

function Table({
  className,
  children,
  filterable = true,
  filterPlaceholder = 'Filter rows…',
  ...props
}: TableProps) {
  const [filter, setFilter] = React.useState('')
  const tableRef = React.useRef<HTMLTableElement | null>(null)

  React.useEffect(() => {
    const needle = filter.trim().toLocaleLowerCase()
    const rows = tableRef.current?.querySelectorAll<HTMLTableRowElement>('tbody > tr') ?? []
    rows.forEach((row) => {
      row.hidden = Boolean(needle) && !row.textContent?.toLocaleLowerCase().includes(needle)
    })
  }, [filter, children])

  return (
    <div className="flex w-full flex-col gap-2">
      {filterable && (
        <Input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={filterPlaceholder}
          aria-label={filterPlaceholder}
          className="w-full sm:w-64"
        />
      )}
      <div data-slot="table-container" className="relative w-full overflow-x-auto">
        <table
          ref={tableRef}
          data-slot="table"
          className={cn('w-full caption-bottom text-sm', className)}
          {...props}
        >
          {children}
        </table>
      </div>
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('[&_tr]:border-b', className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted',
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn('p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0', className)}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
