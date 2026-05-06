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
          <Field label="Qty delta (positive = add, negative = remove)" error={errors.qtyDelta}>
            <Input
              type="number"
              step="0.001"
              value={data.qtyDelta}
              onChange={(e) => setData('qtyDelta', Number(e.target.value))}
            />
          </Field>
          <Field label="Note (required)" error={errors.note}>
            <Input value={data.note} onChange={(e) => setData('note', e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={processing || !target}>
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

export default function InventoryPage({
  inventory,
  recentMovements,
  adjustableItems,
  filters,
}: PageProps) {
  const lowCount = inventory.filter((r) => r.belowThreshold).length
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {inventory.length} stocked items · {lowCount} below threshold.
          </p>
        </div>
        <AdjustDialog items={adjustableItems} />
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
            <p className="text-sm text-muted-foreground">No inventory recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kind</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Avg cost</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((r) => (
                  <TableRow key={`${r.itemKind}:${r.itemId}`}>
                    <TableCell>{r.itemKind}</TableCell>
                    <TableCell className="font-mono text-xs">{r.itemSku}</TableCell>
                    <TableCell className="font-medium">{r.itemName}</TableCell>
                    <TableCell className="text-right">{r.qty}</TableCell>
                    <TableCell>{r.unit}</TableCell>
                    <TableCell className="text-right">{r.avgUnitCost}</TableCell>
                    <TableCell>
                      {r.belowThreshold ? (
                        <Badge variant="destructive">Low</Badge>
                      ) : (
                        <Badge variant="outline">OK</Badge>
                      )}
                    </TableCell>
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
                  <TableHead>When</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentMovements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">
                      {m.createdAt?.slice(0, 19).replace('T', ' ') ?? '—'}
                    </TableCell>
                    <TableCell>{m.reason}</TableCell>
                    <TableCell>{m.itemKind}</TableCell>
                    <TableCell className="text-right">{m.qty}</TableCell>
                    <TableCell className="text-right">{m.unitCost}</TableCell>
                    <TableCell>
                      {m.referenceType && m.referenceId
                        ? `${m.referenceType}#${m.referenceId}`
                        : '—'}
                    </TableCell>
                    <TableCell>{m.note ?? '—'}</TableCell>
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
