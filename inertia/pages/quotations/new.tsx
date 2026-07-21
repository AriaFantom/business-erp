import { type ReactElement } from 'react'
import { Head, useForm } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { ChevronLeft, Package, Plus, Trash2, Wrench, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { EmptyState } from '@/components/empty-state'
import DashboardLayout from '@/layouts/dashboard-layout'

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

type PageProps = {
  customers: CustomerOpt[]
  products: ProductOpt[]
  materials: MaterialOpt[]
  components: ComponentOpt[]
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

export default function QuotationNew({
  customers,
  products,
  materials,
  components,
}: PageProps) {
  const { data, setData, post, processing, errors } = useForm({
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

  const removeLine = (idx: number) =>
    setData(
      'items',
      data.items.filter((_, i) => i !== idx)
    )

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

  const canSubmit = !!data.customerId && data.items.length > 0

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    post('/quotations')
  }

  return (
    <form className="flex w-full flex-col gap-6 px-6 py-8" onSubmit={submit}>
      <Head title="New quotation" />
      <div>
        <Link
          href="/quotations"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to quotations
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">New quotation</h1>
        <p className="text-sm text-muted-foreground">
          Draft a quotation for a customer. Add products from your catalog or build custom lines
          from materials and components.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Who this quotation is for and how long it stays valid.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Customer" required error={errors.customerId}>
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
            <Field label="Note" error={errors.note}>
              <Input
                value={data.note}
                placeholder="Optional"
                onChange={(e) => setData('note', e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Items</CardTitle>
            <CardDescription>At least one line is required.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value="" onValueChange={(v) => addProductLine(Number(v))}>
              <SelectTrigger className="w-56">
                <span className="inline-flex items-center gap-2">
                  <Package className="size-4" />
                  <SelectValue placeholder="Add product…" />
                </span>
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
              <Plus className="mr-1 size-4" /> Add custom item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {typeof errors.items === 'string' && (
            <span className="text-xs text-destructive">{errors.items}</span>
          )}
          {data.items.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="No lines yet"
              description="Add a product from your catalog or build a custom line from materials and components."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[320px]">Name</TableHead>
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
                                  <div className="mb-2 flex items-center justify-between">
                                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                                    <p className="py-2 text-xs text-muted-foreground">
                                      No materials or components added.
                                    </p>
                                  ) : (
                                    <div className="flex flex-col gap-2">
                                      {ln.boms.map((bom, bi) => {
                                        const itemList =
                                          bom.itemKind === 'material' ? materials : components
                                        const item = itemList.find((it) => it.id === bom.itemId)
                                        const lineCost = bom.qty * (item?.unitCost ?? 0)
                                        return (
                                          <div
                                            key={bi}
                                            className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2"
                                          >
                                            <span className="text-[10px] font-medium uppercase text-muted-foreground">
                                              {bom.itemKind === 'material' ? 'Mat' : 'Cmp'}
                                            </span>
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
                                            <span className="w-16 text-right text-xs text-muted-foreground">
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
                              onChange={(e) => updateLine(i, { taxRatePct: Number(e.target.value) })}
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
              </div>

              <div className="flex justify-end">
                <div className="flex w-full max-w-xs flex-col gap-1 rounded bg-muted/40 p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">₹{subtotals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="tabular-nums">₹{subtotals.tax.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex justify-between border-t pt-2 text-base font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">₹{subtotals.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-6 flex items-center justify-end gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur">
        <Link href="/quotations">
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
        <Button type="submit" variant="success" disabled={processing || !canSubmit}>
          {processing ? 'Creating…' : 'Create quotation'}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

QuotationNew.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
