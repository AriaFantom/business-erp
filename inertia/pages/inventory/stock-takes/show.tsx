import { type ReactElement, useMemo, useState } from 'react'
import { useForm } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/confirm-dialog'
import DashboardLayout from '@/layouts/dashboard-layout'

type StockTake = {
  id: number
  number: string
  status: string
  note: string | null
  createdAt: string | null
  completedAt: string | null
}

type Line = {
  id: number
  itemKind: string
  itemId: number
  itemSku: string
  itemName: string
  unit: string
  expectedQty: string
  countedQty: string | null
  unitCost: string
  varianceQty: number | null
  varianceValue: number | null
}

type Totals = {
  countedLines: number
  totalLines: number
  netVarianceValue: number
}

type PageProps = {
  stockTake: StockTake
  lines: Line[]
  totals: Totals
}

function statusVariant(status: string): 'outline' | 'default' | 'secondary' | 'destructive' {
  if (status === 'completed') return 'default'
  if (status === 'cancelled') return 'destructive'
  return 'outline'
}

function fmt(dt: string | null) {
  return dt ? dt.slice(0, 19).replace('T', ' ') : '—'
}

function VarianceCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  if (Math.abs(value) < 0.0005) return <span className="tabular-nums">{value}</span>
  return (
    <span className={value > 0 ? 'text-emerald-600 tabular-nums' : 'text-destructive tabular-nums'}>
      {value > 0 ? '+' : ''}
      {value}
    </span>
  )
}

function PostAction({
  path,
  label,
  variant = 'default',
  confirmTitle,
  confirmDescription,
}: {
  path: string
  label: string
  variant?: 'default' | 'destructive' | 'outline'
  confirmTitle?: string
  confirmDescription?: string
}) {
  const { post, processing } = useForm()
  const [open, setOpen] = useState(false)
  const submit = () => post(path, { preserveScroll: true })

  return (
    <>
      <Button
        variant={variant}
        disabled={processing}
        onClick={() => (confirmTitle ? setOpen(true) : submit())}
      >
        {label}
      </Button>
      {confirmTitle && (
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title={confirmTitle}
          description={confirmDescription}
          confirmLabel="Yes"
          cancelLabel="No"
          variant={variant === 'destructive' ? 'destructive' : 'default'}
          onConfirm={submit}
        />
      )}
    </>
  )
}

export default function StockTakeShow({ stockTake, lines, totals }: PageProps) {
  const editable = stockTake.status === 'draft'
  const [kindFilter, setKindFilter] = useState<'all' | 'material' | 'component' | 'product'>('all')

  const { data, setData, post, processing, transform } = useForm<{
    countsByKey: Record<string, string>
  }>({
    countsByKey: Object.fromEntries(
      lines.map((l) => [`${l.itemKind}:${l.itemId}`, l.countedQty ?? ''])
    ),
  })

  transform((d) => ({
    counts: lines.map((l) => {
      const key = `${l.itemKind}:${l.itemId}`
      const raw = d.countsByKey[key] ?? ''
      return {
        itemKind: l.itemKind,
        itemId: l.itemId,
        countedQty: raw.trim() === '' ? null : Number(raw),
      }
    }),
  }))

  const filteredLines = useMemo(
    () => (kindFilter === 'all' ? lines : lines.filter((l) => l.itemKind === kindFilter)),
    [lines, kindFilter]
  )

  function submitCounts() {
    post(`/inventory/stock-takes/${stockTake.id}/counts`, { preserveScroll: true })
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Stock take {stockTake.number}</h1>
          <p className="text-sm text-muted-foreground">
            Created {fmt(stockTake.createdAt)}
            {stockTake.completedAt ? ` · Completed ${fmt(stockTake.completedAt)}` : ''}
          </p>
          {stockTake.note && <p className="mt-1 text-sm text-muted-foreground">{stockTake.note}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(stockTake.status)}>{stockTake.status}</Badge>
          {editable && (
            <>
              <PostAction
                path={`/inventory/stock-takes/${stockTake.id}/refresh`}
                label="Refresh expected"
                variant="outline"
              />
              <PostAction
                path={`/inventory/stock-takes/${stockTake.id}/complete`}
                label="Complete"
                variant="default"
                confirmTitle="Complete this stock take?"
                confirmDescription={`Applies inventory adjustments for every counted line whose count differs from the current on-hand qty (${totals.countedLines} counted so far). This cannot be undone.`}
              />
              <PostAction
                path={`/inventory/stock-takes/${stockTake.id}/cancel`}
                label="Cancel"
                variant="destructive"
                confirmTitle="Cancel this stock take?"
                confirmDescription="No inventory changes will be applied. This cannot be undone."
              />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lines</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {totals.totalLines}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Counted</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {totals.countedLines}/{totals.totalLines}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net variance value
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            <VarianceCell value={totals.netVarianceValue} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Lines</CardTitle>
          <div className="flex items-center gap-3">
            <Tabs value={kindFilter} onValueChange={(v) => setKindFilter(v as typeof kindFilter)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="material">Materials</TabsTrigger>
                <TabsTrigger value="component">Components</TabsTrigger>
                <TabsTrigger value="product">Products</TabsTrigger>
              </TabsList>
            </Tabs>
            {editable && (
              <Button onClick={submitCounts} disabled={processing}>
                {processing ? 'Saving…' : 'Save counts'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Counted</TableHead>
                <TableHead className="text-right">Variance qty</TableHead>
                <TableHead className="text-right">Variance value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLines.map((l) => {
                const key = `${l.itemKind}:${l.itemId}`
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium">{l.itemName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{l.itemSku}</div>
                    </TableCell>
                    <TableCell>{l.itemKind}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.expectedQty}{' '}
                      <span className="text-xs text-muted-foreground">{l.unit}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {editable ? (
                        <Input
                          aria-label={`Counted quantity for ${l.itemName}`}
                          type="number"
                          min={0}
                          step="0.001"
                          className="ml-auto w-28 text-right"
                          placeholder="uncounted"
                          value={data.countsByKey[key] ?? ''}
                          onChange={(e) =>
                            setData('countsByKey', {
                              ...data.countsByKey,
                              [key]: e.target.value,
                            })
                          }
                        />
                      ) : (
                        <span className="tabular-nums">{l.countedQty ?? '—'}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <VarianceCell value={l.varianceQty} />
                    </TableCell>
                    <TableCell className="text-right">
                      <VarianceCell value={l.varianceValue} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

StockTakeShow.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
