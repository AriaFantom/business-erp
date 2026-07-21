import { type ReactElement, useState } from 'react'
import { useForm } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import DashboardLayout from '@/layouts/dashboard-layout'
import { ListToolbar } from '@/components/catalog/list-toolbar'
import { ColumnVisibilityMenu, type ColumnDef } from '@/components/data-table/column-visibility'
import { useColumnVisibility } from '@/hooks/use-column-visibility'
import { EmptyState } from '@/components/empty-state'
import { Link } from '@adonisjs/inertia/react'
import { Warehouse } from 'lucide-react'

type InventoryRow = {
  itemKind: string
  itemId: number
  itemSku: string
  itemName: string
  qty: string
  avgUnitCost: string
  unit: string
  reorderThreshold: string | null
  belowThreshold: boolean
}

type Movement = {
  id: number
  itemKind: string
  itemId: number
  qty: string
  unitCost: string
  reason: string
  referenceType: string | null
  referenceId: number | null
  note: string | null
  createdAt: string | null
}

type AdjustableItem = {
  itemKind: 'material' | 'component'
  itemId: number
  sku: string
  name: string
  unit: string
}

type Filters = { q: string; itemKind: string; lowStock: boolean }

type PageProps = {
  inventory: InventoryRow[]
  recentMovements: Movement[]
  adjustableItems: AdjustableItem[]
  filters: Filters
}

function AdjustDialog({ items }: { items: AdjustableItem[] }) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<string>('')
  const { data, setData, post, processing, errors, reset } = useForm({
    itemKind: '',
    itemId: 0,
    qtyDelta: 0,
    note: '',
  })

  const onTargetChange = (v: string) => {
    setTarget(v)
    const [kind, idStr] = v.split(':')
    setData('itemKind', kind)
    setData('itemId', Number(idStr))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Adjust stock</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manual stock adjustment</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            post('/inventory/adjustments', {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setTarget('')
                setOpen(false)
              },
            })
          }}
        >
          <Field label="Item" error={errors.itemKind ?? errors.itemId}>
            <Select value={target} onValueChange={onTargetChange}>
              <SelectTrigger>
                <SelectValue placeholder="Pick item" />
              </SelectTrigger>
              <SelectContent>
                {items.map((it) => (
                  <SelectItem
                    key={`${it.itemKind}:${it.itemId}`}
                    value={`${it.itemKind}:${it.itemId}`}
                  >
                    [{it.itemKind}] {it.name} ({it.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label={
              target
                ? `Qty delta (${
                    items.find((it) => `${it.itemKind}:${it.itemId}` === target)?.unit ?? ''
                  }) — positive = add, negative = remove`
                : 'Qty delta (positive = add, negative = remove)'
            }
            error={errors.qtyDelta}
          >
            <Input
              type="number"
              step="0.001"
              placeholder="+10 to add, -10 to remove"
              value={data.qtyDelta}
              onChange={(e) => setData('qtyDelta', Number(e.target.value))}
            />
          </Field>
          <Field label="Note (required)" error={errors.note}>
            <Input
              placeholder="Why is this adjustment needed?"
              value={data.note}
              onChange={(e) => setData('note', e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" variant="success" disabled={processing || !target}>
              {processing ? 'Saving…' : 'Apply'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

const STOCK_COLUMNS: ColumnDef[] = [
  { key: 'kind', label: 'Kind' },
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Name', required: true },
  { key: 'qty', label: 'Qty' },
  { key: 'unit', label: 'Unit' },
  { key: 'cost', label: 'Avg cost' },
  { key: 'status', label: 'Status' },
]

const MOVE_COLUMNS: ColumnDef[] = [
  { key: 'when', label: 'When' },
  { key: 'reason', label: 'Reason' },
  { key: 'kind', label: 'Kind' },
  { key: 'qty', label: 'Qty', required: true },
  { key: 'unitCost', label: 'Unit cost' },
  { key: 'reference', label: 'Reference' },
  { key: 'note', label: 'Note' },
]

export default function InventoryPage({
  inventory,
  recentMovements,
  adjustableItems,
  filters,
}: PageProps) {
  const lowCount = inventory.filter((r) => r.belowThreshold).length
  const stockCols = useColumnVisibility('inventory.stock')
  const moveCols = useColumnVisibility('inventory.movements')
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {inventory.length} stocked items · {lowCount} below threshold.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/inventory/stock-takes">Stock takes</Link>
          </Button>
          <AdjustDialog items={adjustableItems} />
        </div>
      </div>

      <ListToolbar
        basePath="/inventory"
        q={filters.q}
        searchPlaceholder="Search by name or SKU…"
        selects={[
          {
            name: 'itemKind',
            value: filters.itemKind,
            options: [
              { value: 'all', label: 'All kinds' },
              { value: 'material', label: 'Materials' },
              { value: 'component', label: 'Components' },
              { value: 'product', label: 'Products' },
            ],
          },
          {
            name: 'lowStock',
            value: filters.lowStock ? '1' : 'all',
            options: [
              { value: 'all', label: 'All stock levels' },
              { value: '1', label: 'Low stock only' },
            ],
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>On hand</CardTitle>
        </CardHeader>
        <CardContent>
          {inventory.length === 0 ? (
            <EmptyState
              icon={Warehouse}
              title="No inventory recorded yet"
              description="Stock arrives by confirming purchases. Record one to populate inventory."
              action={
                <Button asChild variant="outline">
                  <Link href="/purchases">Go to purchases</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {stockCols.isVisible('kind') && <TableHead>Kind</TableHead>}
                  {stockCols.isVisible('sku') && <TableHead>SKU</TableHead>}
                  {stockCols.isVisible('name') && <TableHead>Name</TableHead>}
                  {stockCols.isVisible('qty') && <TableHead className="text-right">Qty</TableHead>}
                  {stockCols.isVisible('unit') && <TableHead>Unit</TableHead>}
                  {stockCols.isVisible('cost') && (
                    <TableHead className="text-right">Avg cost</TableHead>
                  )}
                  {stockCols.isVisible('status') && <TableHead>Status</TableHead>}
                  <TableHead className="w-12 text-right">
                    <ColumnVisibilityMenu
                      columns={STOCK_COLUMNS}
                      isVisible={stockCols.isVisible}
                      onToggle={stockCols.toggle}
                      onReset={stockCols.reset}
                      compact
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((r) => (
                  <TableRow key={`${r.itemKind}:${r.itemId}`}>
                    {stockCols.isVisible('kind') && <TableCell>{r.itemKind}</TableCell>}
                    {stockCols.isVisible('sku') && (
                      <TableCell className="font-mono text-xs">{r.itemSku}</TableCell>
                    )}
                    {stockCols.isVisible('name') && (
                      <TableCell className="font-medium">{r.itemName}</TableCell>
                    )}
                    {stockCols.isVisible('qty') && (
                      <TableCell className="text-right tabular-nums">
                        {r.qty} <span className="text-xs text-muted-foreground">{r.unit}</span>
                      </TableCell>
                    )}
                    {stockCols.isVisible('unit') && <TableCell>{r.unit}</TableCell>}
                    {stockCols.isVisible('cost') && (
                      <TableCell className="text-right">{r.avgUnitCost}</TableCell>
                    )}
                    {stockCols.isVisible('status') && (
                      <TableCell>
                        {r.belowThreshold ? (
                          <Badge variant="destructive">Low</Badge>
                        ) : (
                          <Badge variant="outline">OK</Badge>
                        )}
                      </TableCell>
                    )}
                    <TableCell />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent movements</CardTitle>
        </CardHeader>
        <CardContent>
          {recentMovements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No movements yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {moveCols.isVisible('when') && <TableHead>When</TableHead>}
                  {moveCols.isVisible('reason') && <TableHead>Reason</TableHead>}
                  {moveCols.isVisible('kind') && <TableHead>Kind</TableHead>}
                  {moveCols.isVisible('qty') && <TableHead className="text-right">Qty</TableHead>}
                  {moveCols.isVisible('unitCost') && (
                    <TableHead className="text-right">Unit cost</TableHead>
                  )}
                  {moveCols.isVisible('reference') && <TableHead>Reference</TableHead>}
                  {moveCols.isVisible('note') && <TableHead>Note</TableHead>}
                  <TableHead className="w-12 text-right">
                    <ColumnVisibilityMenu
                      columns={MOVE_COLUMNS}
                      isVisible={moveCols.isVisible}
                      onToggle={moveCols.toggle}
                      onReset={moveCols.reset}
                      compact
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentMovements.map((m) => (
                  <TableRow key={m.id}>
                    {moveCols.isVisible('when') && (
                      <TableCell className="font-mono text-xs">
                        {m.createdAt?.slice(0, 19).replace('T', ' ') ?? '—'}
                      </TableCell>
                    )}
                    {moveCols.isVisible('reason') && <TableCell>{m.reason}</TableCell>}
                    {moveCols.isVisible('kind') && <TableCell>{m.itemKind}</TableCell>}
                    {moveCols.isVisible('qty') && (
                      <TableCell className="text-right">{m.qty}</TableCell>
                    )}
                    {moveCols.isVisible('unitCost') && (
                      <TableCell className="text-right">{m.unitCost}</TableCell>
                    )}
                    {moveCols.isVisible('reference') && (
                      <TableCell>
                        {m.referenceType && m.referenceId
                          ? `${m.referenceType}#${m.referenceId}`
                          : '—'}
                      </TableCell>
                    )}
                    {moveCols.isVisible('note') && <TableCell>{m.note ?? '—'}</TableCell>}
                    <TableCell />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

InventoryPage.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
