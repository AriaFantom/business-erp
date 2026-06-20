import { type ReactElement, useState } from 'react'
import { useForm, router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { CheckCircle2, ExternalLink, FileText, Send, Trash2, Plus, X } from 'lucide-react'
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
import { StatCard } from '@/components/catalog/stat-card'
import { ColumnVisibilityMenu, type ColumnDef } from '@/components/data-table/column-visibility'
import { useColumnVisibility } from '@/hooks/use-column-visibility'

type QuotationRow = {
  id: number
  number: string
  customerId: number
  customerName: string
  status: string
  issuedAt: string | null
  validUntil: string | null
  total: string
}

type CustomerOpt = { id: number; name: string }
type ProductOpt = {
  id: number
  sku: string
  name: string
  unitCost: number
  profitPct: number
  taxRatePct: number
  suggestedUnitPrice: number
}
type MaterialOpt = { id: number; name: string; unitCost: number }
type ComponentOpt = { id: number; name: string; unitCost: number }

type Filters = { q: string; status: string; customerId: string }

type PageProps = {
  quotations: QuotationRow[]
  customers: CustomerOpt[]
  products: ProductOpt[]
  materials: MaterialOpt[]
  components: ComponentOpt[]
  filters: Filters
}

type BomDraft = {
  itemKind: 'material' | 'component'
  itemId: number
  qty: number
}

type LineDraft = {
  productId?: number
  name: string
  qty: number
  unitPrice?: number
  unitCost?: number
  profitPctOverride?: number
  taxRatePct: number
  boms: BomDraft[]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function computeBomCost(
  boms: BomDraft[],
  materials: MaterialOpt[],
  components: ComponentOpt[]
): number {
  const matById = new Map(materials.map((m) => [m.id, m.unitCost]))
  const compById = new Map(components.map((c) => [c.id, c.unitCost]))
  let cost = 0
  for (const b of boms) {
    const unitCost =
      b.itemKind === 'material' ? (matById.get(b.itemId) ?? 0) : (compById.get(b.itemId) ?? 0)
    cost += b.qty * unitCost
  }
  return round2(cost)
}

function computeCustomUnitPrice(cost?: number, profitPct?: number): number {
  return round2((cost ?? 0) * (1 + (profitPct ?? 0) / 100))
}

function statusVariant(s: string) {
  if (s === 'accepted' || s === 'converted') return 'default' as const
  if (s === 'rejected' || s === 'expired') return 'destructive' as const
  if (s === 'sent') return 'secondary' as const
  return 'outline' as const
}

function NewQuotationDialog({
  customers,
  products,
  materials,
  components,
}: {
  customers: CustomerOpt[]
  products: ProductOpt[]
  materials: MaterialOpt[]
  components: ComponentOpt[]
}) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset } = useForm({
    customerId: '',
    validUntil: new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10),
    note: '',
    items: [] as LineDraft[],
  })

  const addProductLine = (productId: number) => {
    const p = products.find((pp) => pp.id === productId)
    if (!p) return
    setData('items', [
      ...data.items,
      {
        productId,
        name: `${p.name} (${p.sku})`,
        qty: 1,
        unitPrice: p.suggestedUnitPrice,
        profitPctOverride: p.profitPct,
        taxRatePct: p.taxRatePct,
        boms: [],
      },
    ])
  }

  const addCustomLine = () =>
    setData('items', [
      ...data.items,
      {
        name: '',
        qty: 1,
        unitCost: 0,
        profitPctOverride: 30,
        unitPrice: 0,
        taxRatePct: 18,
        boms: [],
      },
    ])

  const updateLine = (idx: number, patch: Partial<LineDraft>) =>
    setData(
      'items',
      data.items.map((l, i) => (i === idx ? { ...l, ...patch } : l))
    )

  const addBom = (lineIdx: number, itemKind: 'material' | 'component') => {
    const items = itemKind === 'material' ? materials : components
    const firstId = items[0]?.id
    if (!firstId) return
    const line = data.items[lineIdx]
    const newBoms = [...line.boms, { itemKind, itemId: firstId, qty: 1 }]
    const newCost = computeBomCost(newBoms, materials, components)
    setData(
      'items',
      data.items.map((l, i) =>
        i === lineIdx
          ? {
              ...l,
              boms: newBoms,
              unitCost: newCost,
              unitPrice: computeCustomUnitPrice(newCost, l.profitPctOverride),
            }
          : l
      )
    )
  }

  const updateBom = (lineIdx: number, bomIdx: number, patch: Partial<BomDraft>) => {
    const line = data.items[lineIdx]
    const newBoms = line.boms.map((b, i) => (i === bomIdx ? { ...b, ...patch } : b))
    const newCost = computeBomCost(newBoms, materials, components)
    setData(
      'items',
      data.items.map((l, i) =>
        i === lineIdx
          ? {
              ...l,
              boms: newBoms,
              unitCost: newCost,
              unitPrice: computeCustomUnitPrice(newCost, l.profitPctOverride),
            }
          : l
      )
    )
  }

  const removeBom = (lineIdx: number, bomIdx: number) => {
    const line = data.items[lineIdx]
    const newBoms = line.boms.filter((_, i) => i !== bomIdx)
    const newCost = computeBomCost(newBoms, materials, components)
    setData(
      'items',
      data.items.map((l, i) =>
        i === lineIdx
          ? {
              ...l,
              boms: newBoms,
              unitCost: newCost,
              unitPrice: computeCustomUnitPrice(newCost, l.profitPctOverride),
            }
          : l
      )
    )
  }

  const subtotals = data.items.reduce(
    (acc, ln) => {
      const ls = Math.round((ln.qty || 0) * (ln.unitPrice || 0) * 100) / 100
      const lt = Math.round(((ls * (ln.taxRatePct || 0)) / 100) * 100) / 100
      acc.subtotal += ls
      acc.tax += lt
      acc.total += ls + lt
      return acc
    },
    { subtotal: 0, tax: 0, total: 0 }
  )

  const removeLine = (idx: number) =>
    setData(
      'items',
      data.items.filter((_, i) => i !== idx)
    )

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    post('/quotations', {
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
        <Button>New quotation</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create quotation</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer" error={errors.customerId}>
              <Select value={data.customerId} onValueChange={(v) => setData('customerId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Valid until" error={errors.validUntil}>
              <Input
                type="date"
                value={data.validUntil}
                onChange={(e) => setData('validUntil', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Note" error={errors.note}>
            <Input value={data.note} onChange={(e) => setData('note', e.target.value)} />
          </Field>

          <div className="rounded border p-3">
            <div className="mb-3 flex flex-col gap-2">
              <span className="text-sm font-medium">Add line</span>
              <div className="flex flex-wrap items-center gap-2">
                <Select onValueChange={(v) => addProductLine(Number(v))}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="From product…" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} ({p.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addCustomLine}>
                  Custom line
                </Button>
              </div>
            </div>

            {data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lines.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[280px]">Name</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit cost</TableHead>
                      <TableHead>Profit %</TableHead>
                      <TableHead>Unit price</TableHead>
                      <TableHead>Tax %</TableHead>
                      <TableHead className="text-right">Line total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((ln, i) => {
                      const isCustom = !ln.productId
                      const ls = Math.round((ln.qty || 0) * (ln.unitPrice || 0) * 100) / 100
                      const lt = Math.round(((ls * (ln.taxRatePct || 0)) / 100) * 100) / 100
                      const lto = Math.round((ls + lt) * 100) / 100
                      return (
                        <TableRow key={i}>
                          <TableCell className="align-top">
                            <div className="flex flex-col gap-3">
                              <Input
                                value={ln.name}
                                placeholder={isCustom ? 'Product name' : ''}
                                onChange={(e) => updateLine(i, { name: e.target.value })}
                              />
                              {isCustom && (
                                <div className="rounded border bg-muted/30 p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                      BOM Entries
                                    </span>
                                    <div className="flex gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => addBom(i, 'material')}
                                      >
                                        <Plus className="mr-1 size-3" />
                                        Material
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => addBom(i, 'component')}
                                      >
                                        <Plus className="mr-1 size-3" />
                                        Component
                                      </Button>
                                    </div>
                                  </div>
                                  {ln.boms.length === 0 ? (
                                    <p className="text-xs text-muted-foreground py-2">
                                      No materials or components added.
                                    </p>
                                  ) : (
                                    <div className="flex flex-col gap-2">
                                      {ln.boms.map((bom, bi) => {
                                        const itemList = bom.itemKind === 'material' ? materials : components
                                        const item = itemList.find((it) => it.id === bom.itemId)
                                        const lineCost = bom.qty * (item?.unitCost ?? 0)
                                        return (
                                          <div key={bi} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2">
                                            <Select
                                              value={String(bom.itemId)}
                                              onValueChange={(v) =>
                                                updateBom(i, bi, { itemId: Number(v) })
                                              }
                                            >
                                              <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {itemList.map((it) => (
                                                  <SelectItem key={it.id} value={String(it.id)}>
                                                    {it.name}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                            <Input
                                              type="number"
                                              step="0.0001"
                                              value={bom.qty}
                                              onChange={(e) =>
                                                updateBom(i, bi, {
                                                  qty: Number(e.target.value),
                                                })
                                              }
                                              className="h-8 w-20 text-xs"
                                            />
                                            <span className="text-xs text-muted-foreground w-16 text-right">
                                              ₹{lineCost.toFixed(2)}
                                            </span>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7"
                                              onClick={() => removeBom(i, bi)}
                                            >
                                              <X className="size-3" />
                                            </Button>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              type="number"
                              value={ln.qty}
                              onChange={(e) => updateLine(i, { qty: Number(e.target.value) })}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            {isCustom ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm tabular-nums">
                                  ₹{ln.unitCost?.toFixed(2) ?? '0.00'}
                                </span>
                                <span className="text-[10px] text-muted-foreground">from BOM</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="align-top">
                            {isCustom ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={ln.profitPctOverride ?? ''}
                                onChange={(e) => {
                                  const profit = e.target.value ? Number(e.target.value) : undefined
                                  updateLine(i, {
                                    profitPctOverride: profit,
                                    unitPrice: computeCustomUnitPrice(ln.unitCost, profit),
                                  })
                                }}
                                className="w-20"
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              type="number"
                              step="0.0001"
                              value={ln.unitPrice ?? ''}
                              placeholder={ln.productId ? 'auto' : '0'}
                              readOnly={isCustom}
                              onChange={(e) =>
                                updateLine(i, {
                                  unitPrice: e.target.value ? Number(e.target.value) : undefined,
                                })
                              }
                              className="w-28"
                            />
                          </TableCell>
                          <TableCell className="align-top">
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
                          <TableCell className="align-top text-right tabular-nums">
                            ₹{lto.toFixed(2)}
                          </TableCell>
                          <TableCell className="align-top">
                            <Button
                              type="button"
                              variant="destructive-soft"
                              size="icon"
                              aria-label="Remove line"
                              onClick={() => removeLine(i)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <div className="mt-3 flex flex-col gap-1 rounded bg-muted/40 p-3 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>₹{subtotals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>₹{subtotals.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>₹{subtotals.total.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="submit"
              variant="success"
              disabled={processing || !data.customerId || data.items.length === 0}
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

const QUOTATION_COLUMNS: ColumnDef[] = [
  { key: 'number', label: 'Number', required: true },
  { key: 'customer', label: 'Customer' },
  { key: 'status', label: 'Status' },
  { key: 'issued', label: 'Issued' },
  { key: 'validUntil', label: 'Valid until' },
  { key: 'total', label: 'Total' },
  { key: 'actions', label: 'Actions', required: true },
]

export default function QuotationsIndex({
  quotations,
  customers,
  products,
  materials,
  components,
  filters,
}: PageProps) {
  // Use router for type checking suppression
  void router
  const { isVisible, toggle, reset } = useColumnVisibility('quotations')
  const totalValue = quotations.reduce((s, q) => s + Number(q.total || 0), 0)
  const accepted = quotations.filter(
    (q) => q.status === 'accepted' || q.status === 'converted'
  ).length
  const draftSent = quotations.filter((q) => q.status === 'draft' || q.status === 'sent').length
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Quotations</h1>
        </div>
        <div className="flex items-center gap-2">
          <NewQuotationDialog
            customers={customers}
            products={products}
            materials={materials}
            components={components}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total quotations" value={quotations.length} icon={FileText} />
        <StatCard label="In flight" value={draftSent} hint="Draft or sent" icon={Send} />
        <StatCard
          label="Accepted / converted"
          value={accepted}
          hint={`Pipeline value ₹${totalValue.toFixed(2)}`}
          icon={CheckCircle2}
        />
      </div>

      <ListToolbar
        basePath="/quotations"
        q={filters.q}
        searchPlaceholder="Search by number…"
        selects={[
          {
            name: 'status',
            value: filters.status,
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'sent', label: 'Sent' },
              { value: 'accepted', label: 'Accepted' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'expired', label: 'Expired' },
              { value: 'converted', label: 'Converted' },
            ],
          },
          {
            name: 'customerId',
            value: filters.customerId,
            options: [
              { value: 'all', label: 'All customers' },
              ...customers.map((c) => ({ value: String(c.id), label: c.name })),
            ],
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>All quotations</CardTitle>
        </CardHeader>
        <CardContent>
          {quotations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No quotations yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isVisible('number') && <TableHead>Number</TableHead>}
                  {isVisible('customer') && <TableHead>Customer</TableHead>}
                  {isVisible('status') && <TableHead>Status</TableHead>}
                  {isVisible('issued') && <TableHead>Issued</TableHead>}
                  {isVisible('validUntil') && <TableHead>Valid until</TableHead>}
                  {isVisible('total') && <TableHead className="text-right">Total</TableHead>}
                  {isVisible('actions') && (
                    <TableHead className="w-20 text-right">
                      <ColumnVisibilityMenu
                        columns={QUOTATION_COLUMNS}
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
                {quotations.map((q) => (
                  <TableRow key={q.id}>
                    {isVisible('number') && (
                      <TableCell className="font-mono text-xs">{q.number}</TableCell>
                    )}
                    {isVisible('customer') && <TableCell>{q.customerName}</TableCell>}
                    {isVisible('status') && (
                      <TableCell>
                        <Badge variant={statusVariant(q.status)}>{q.status}</Badge>
                      </TableCell>
                    )}
                    {isVisible('issued') && (
                      <TableCell>{q.issuedAt?.slice(0, 10) ?? '—'}</TableCell>
                    )}
                    {isVisible('validUntil') && (
                      <TableCell>{q.validUntil?.slice(0, 10) ?? '—'}</TableCell>
                    )}
                    {isVisible('total') && <TableCell className="text-right">{q.total}</TableCell>}
                    {isVisible('actions') && (
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="icon" aria-label="Open quotation">
                          <Link href={`/quotations/${q.id}`}>
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

QuotationsIndex.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
