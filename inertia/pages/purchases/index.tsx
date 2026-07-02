import { type ReactElement, useState } from 'react'
import { useForm } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
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
import { StatusBadge } from '@/components/status-badge'
import { EmptyState } from '@/components/empty-state'
import DashboardLayout from '@/layouts/dashboard-layout'
import { ListToolbar } from '@/components/catalog/list-toolbar'
import { StatCard } from '@/components/catalog/stat-card'
import { CheckCircle2, ExternalLink, Truck, XCircle } from 'lucide-react'
import {
  ColumnVisibilityMenu,
  type ColumnDef,
} from '@/components/data-table/column-visibility'
import { useColumnVisibility } from '@/hooks/use-column-visibility'

type PurchaseRow = {
  id: number
  number: string
  supplierId: number
  supplierName: string
  status: string
  purchasedAt: string | null
  total: string
  paidTotal: string
  balanceDue: string
  confirmedAt: string | null
}

type SupplierOpt = { id: number; name: string }
type ItemOpt = {
  id: number
  sku: string
  name: string
  unit: string
  defaultUnitCost: string
}

type Filters = { q: string; status: string; supplierId: string }

type PageProps = {
  purchases: PurchaseRow[]
  suppliers: SupplierOpt[]
  materials: ItemOpt[]
  components: ItemOpt[]
  filters: Filters
}

type LineDraft = {
  itemKind: 'material' | 'component'
  itemId: number
  qty: number
  unitCost: number
  taxRatePct: number
}


function NewPurchaseDialog({
  suppliers,
  materials,
  components,
}: {
  suppliers: SupplierOpt[]
  materials: ItemOpt[]
  components: ItemOpt[]
}) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset } = useForm({
    supplierId: '',
    purchasedAt: new Date().toISOString().slice(0, 10),
    note: '',
    items: [] as LineDraft[],
  })

  const addLine = (kind: 'material' | 'component', itemId: number) => {
    const pool = kind === 'material' ? materials : components
    const it = pool.find((p) => p.id === itemId)
    if (!it) return
    setData('items', [
      ...data.items,
      {
        itemKind: kind,
        itemId,
        qty: 1,
        unitCost: Number(it.defaultUnitCost),
        taxRatePct: 18,
      },
    ])
  }

  const removeLine = (idx: number) =>
    setData('items', data.items.filter((_, i) => i !== idx))

  const updateLine = (idx: number, patch: Partial<LineDraft>) =>
    setData(
      'items',
      data.items.map((ln, i) => (i === idx ? { ...ln, ...patch } : ln))
    )

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    post('/purchases', {
      preserveScroll: true,
      onSuccess: () => {
        reset()
        setOpen(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New purchase</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create purchase</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier" error={errors.supplierId}>
              <Select
                value={data.supplierId}
                onValueChange={(v) => setData('supplierId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Purchased on" error={errors.purchasedAt}>
              <Input
                type="date"
                value={data.purchasedAt}
                onChange={(e) => setData('purchasedAt', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Note" error={errors.note}>
            <Input
              value={data.note}
              onChange={(e) => setData('note', e.target.value)}
            />
          </Field>

          <div className="rounded border p-3">
            <div className="mb-3 flex flex-col gap-2">
              <span className="text-sm font-medium">Add line</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Select onValueChange={(v) => addLine('material', Number(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Add material…" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name} ({m.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select onValueChange={(v) => addLine('component', Number(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Add component…" />
                  </SelectTrigger>
                  <SelectContent>
                    {components.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name} ({c.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lines yet.</p>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit cost</TableHead>
                    <TableHead>Tax %</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((ln, i) => {
                    const pool = ln.itemKind === 'material' ? materials : components
                    const it = pool.find((p) => p.id === ln.itemId)
                    return (
                      <TableRow key={i}>
                        <TableCell className="text-sm">
                          [{ln.itemKind}] {it?.name ?? '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.001"
                              value={ln.qty}
                              onChange={(e) =>
                                updateLine(i, { qty: Number(e.target.value) })
                              }
                              className="w-24"
                            />
                            <span className="text-xs text-muted-foreground">
                              {it?.unit ?? ''}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.0001"
                              value={ln.unitCost}
                              onChange={(e) =>
                                updateLine(i, { unitCost: Number(e.target.value) })
                              }
                              className="w-28"
                            />
                            <span className="text-xs text-muted-foreground">
                              /{it?.unit ?? ''}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={ln.taxRatePct}
                            onChange={(e) =>
                              updateLine(i, { taxRatePct: Number(e.target.value) })
                            }
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="destructive-soft"
                            size="sm"
                            onClick={() => removeLine(i)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="submit"
              variant="success"
              disabled={processing || !data.supplierId || data.items.length === 0}
            >
              {processing ? 'Saving…' : 'Create draft'}
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

const PURCHASE_COLUMNS: ColumnDef[] = [
  { key: 'number', label: 'Number', required: true },
  { key: 'supplier', label: 'Supplier' },
  { key: 'status', label: 'Status' },
  { key: 'purchasedOn', label: 'Purchased on' },
  { key: 'total', label: 'Total' },
  { key: 'due', label: 'Due' },
  { key: 'actions', label: 'Actions', required: true },
]

export default function PurchasesIndex({
  purchases,
  suppliers,
  materials,
  components,
  filters,
}: PageProps) {
  const { isVisible, toggle, reset } = useColumnVisibility('purchases')
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Purchases</h1>
        </div>
        <div className="flex items-center gap-2">
          <NewPurchaseDialog
            suppliers={suppliers}
            materials={materials}
            components={components}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total purchases" value={purchases.length} icon={Truck} />
        <StatCard
          label="Confirmed"
          value={purchases.filter((p) => p.status === 'confirmed').length}
          hint={`Spent ₹${purchases
            .filter((p) => p.status === 'confirmed')
            .reduce((s, p) => s + Number(p.total || 0), 0)
            .toFixed(2)}`}
          icon={CheckCircle2}
        />
        <StatCard
          label="Cancelled"
          value={purchases.filter((p) => p.status === 'cancelled').length}
          icon={XCircle}
        />
      </div>

      <ListToolbar
        basePath="/purchases"
        q={filters.q}
        searchPlaceholder="Search by number…"
        selects={[
          {
            name: 'status',
            value: filters.status,
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
          {
            name: 'supplierId',
            value: filters.supplierId,
            options: [
              { value: 'all', label: 'All suppliers' },
              ...suppliers.map((s) => ({ value: String(s.id), label: s.name })),
            ],
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>All purchases</CardTitle>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No purchases yet"
              description="Record a purchase order to bring stock into inventory."
              action={
                <NewPurchaseDialog
                  suppliers={suppliers}
                  materials={materials}
                  components={components}
                />
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isVisible('number') && <TableHead>Number</TableHead>}
                  {isVisible('supplier') && <TableHead>Supplier</TableHead>}
                  {isVisible('status') && <TableHead>Status</TableHead>}
                  {isVisible('purchasedOn') && <TableHead>Purchased on</TableHead>}
                  {isVisible('total') && (
                    <TableHead className="text-right">Total</TableHead>
                  )}
                  {isVisible('due') && <TableHead className="text-right">Due</TableHead>}
                  {isVisible('actions') && (
                    <TableHead className="w-20 text-right">
                      <ColumnVisibilityMenu
                        columns={PURCHASE_COLUMNS}
                        isVisible={isVisible}
                        onToggle={toggle}
                        onReset={reset}
                        compact
                      />
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((p) => (
                  <TableRow key={p.id}>
                    {isVisible('number') && (
                      <TableCell className="font-mono text-xs">{p.number}</TableCell>
                    )}
                    {isVisible('supplier') && <TableCell>{p.supplierName}</TableCell>}
                    {isVisible('status') && (
                      <TableCell>
                        <StatusBadge kind="purchase" status={p.status} />
                      </TableCell>
                    )}
                    {isVisible('purchasedOn') && (
                      <TableCell>{p.purchasedAt?.slice(0, 10) ?? '—'}</TableCell>
                    )}
                    {isVisible('total') && (
                      <TableCell className="text-right">{p.total}</TableCell>
                    )}
                    {isVisible('due') && (
                      <TableCell className="text-right tabular-nums">
                        {p.status === 'confirmed' && Number(p.balanceDue) > 0.005 ? (
                          <span className="font-medium">{p.balanceDue}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {isVisible('actions') && (
                      <TableCell className="text-right">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          aria-label="Open purchase"
                        >
                          <Link href={`/purchases/${p.id}`}>
                            <ExternalLink className="size-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    )}
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

PurchasesIndex.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
