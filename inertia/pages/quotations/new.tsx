import { type ReactElement, useState } from 'react'
import { Head, useForm } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Calculator, ChevronLeft, Package, Plus, Trash2, Wrench, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
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
import { formatMoney, useCurrency } from '@/lib/currency'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { useMeasurementUnits, formatQuantity } from '@/lib/quantity_units'
import { QuantityUnitSelect } from '@/components/catalog/quantity-unit-select'

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
type MaterialOpt = { id: number; name: string; unit: string; unitCost: number }
type ComponentOpt = { id: number; name: string; unit: string; unitCost: number }

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
  unit?: string
}

type LineDraft = {
  productId?: number
  name: string
  qty: number
  unit?: string
  unitPrice?: number
  unitCost?: number
  profitPctOverride?: number
  taxRatePct: number
  boms: BomDraft[]
  pricingMode?: 'manual' | 'estimated'
  estimate?: {
    extraCost: number
    profitPct: number
    expectedFingerprint: string
  }
  estimateTarget?: number
}

type EstimateResult = {
  materialCost: number
  componentCost: number
  catalogCost: number
  extraCost: number
  estimatedUnitCost: number
  profitPct: number
  profitFrom: 'category' | 'product' | 'global'
  suggestedUnitPrice: number
  fingerprint: string
  boms: Array<{
    itemKind: 'material' | 'component'
    itemId: number
    name: string
    unit: string
    qty: number
    unitCost: number
    lineCost: number
    zeroCost: boolean
  }>
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function computeBomCost(
  boms: BomDraft[],
  materials: MaterialOpt[],
  components: ComponentOpt[],
  convertDisplayQuantity: ReturnType<typeof useMeasurementUnits>['convertDisplayQuantity']
): number {
  const matById = new Map(materials.map((m) => [m.id, m.unitCost]))
  const compById = new Map(components.map((c) => [c.id, c.unitCost]))
  let cost = 0
  for (const b of boms) {
    const items = b.itemKind === 'material' ? materials : components
    const item = items.find((candidate) => candidate.id === b.itemId)
    const unitCost =
      b.itemKind === 'material' ? (matById.get(b.itemId) ?? 0) : (compById.get(b.itemId) ?? 0)
    const storedQty = item ? convertDisplayQuantity(b.qty, b.unit || item.unit, item.unit) : b.qty
    cost += storedQty * unitCost
  }
  return round2(cost)
}

function computeCustomUnitPrice(cost?: number, profitPct?: number): number {
  return round2((cost ?? 0) * (1 + (profitPct ?? 0) / 100))
}

function xsrfToken() {
  const cookie = document.cookie.split('; ').find((part) => part.startsWith('XSRF-TOKEN='))
  return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : ''
}

function EstimateDialog({
  line,
  quantity,
  materials,
  components,
  onApply,
}: {
  line: LineDraft
  quantity: number
  materials: MaterialOpt[]
  components: ComponentOpt[]
  onApply: (result: EstimateResult, boms: BomDraft[]) => void
}) {
  const currency = useCurrency()
  const { compatibleUnits, convertDisplayQuantity } = useMeasurementUnits()
  const [open, setOpen] = useState(false)
  const [boms, setBoms] = useState<BomDraft[]>(line.boms)
  const [extraCost, setExtraCost] = useState(String(line.estimate?.extraCost ?? 0))
  const [profitPct, setProfitPct] = useState(line.estimate ? String(line.estimate.profitPct) : '')
  const [result, setResult] = useState<EstimateResult | null>(null)
  const [loading, setLoading] = useState(false)

  const addBom = (itemKind: 'material' | 'component') => {
    const options = itemKind === 'material' ? materials : components
    if (!options[0]) return
    setBoms((current) => [
      ...current,
      { itemKind, itemId: options[0].id, qty: 1, unit: options[0].unit },
    ])
    setResult(null)
  }

  const preview = async () => {
    setLoading(true)
    try {
      const response = await fetch('/quotations/estimate', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': xsrfToken(),
        },
        body: JSON.stringify({
          productId: line.productId ?? null,
          extraCost: Number(extraCost || 0),
          profitPct: profitPct === '' ? null : Number(profitPct),
          boms,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'The estimate could not be calculated.')
      setResult(body.data)
      setProfitPct(String(body.data.profitPct))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The estimate could not be calculated.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setBoms(line.boms)
          setExtraCost(String(line.estimate?.extraCost ?? 0))
          setProfitPct(line.estimate ? String(line.estimate.profitPct) : '')
          setResult(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Calculator data-icon="inline-start" />
          Estimate cost
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Estimate cost — {line.name || 'custom item'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Enter the materials and costs for one product. This estimate does not reserve stock or
            change the saved product price.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Materials and components per product</Label>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => addBom('material')}>
                <Plus data-icon="inline-start" /> Material
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addBom('component')}>
                <Plus data-icon="inline-start" /> Component
              </Button>
            </div>
          </div>
          {boms.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No catalog items added. You can still estimate using only the extra cost.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {boms.map((bom, index) => {
                const options = bom.itemKind === 'material' ? materials : components
                const selected = options.find((item) => item.id === bom.itemId)
                return (
                  <div
                    key={`${bom.itemKind}-${index}`}
                    className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_9rem_7rem_auto] sm:items-end"
                  >
                    <Field label={bom.itemKind === 'material' ? 'Material' : 'Component'}>
                      <Select
                        value={String(bom.itemId)}
                        onValueChange={(value) => {
                          const nextItem = options.find((item) => item.id === Number(value))
                          setBoms((current) =>
                            current.map((entry, i) =>
                              i === index
                                ? {
                                    ...entry,
                                    itemId: Number(value),
                                    unit: nextItem?.unit,
                                  }
                                : entry
                            )
                          )
                          setResult(null)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {options.map((item) => (
                              <SelectItem key={item.id} value={String(item.id)}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Quantity">
                      <Input
                        type="number"
                        min={0.000000001}
                        step="any"
                        value={bom.qty}
                        onChange={(event) => {
                          setBoms((current) =>
                            current.map((entry, i) =>
                              i === index ? { ...entry, qty: Number(event.target.value) } : entry
                            )
                          )
                          setResult(null)
                        }}
                      />
                    </Field>
                    <Field label="Unit">
                      <Select
                        value={bom.unit || selected?.unit || ''}
                        onValueChange={(nextUnit) => {
                          const currentUnit = bom.unit || selected?.unit || nextUnit
                          setBoms((current) =>
                            current.map((entry, i) =>
                              i === index
                                ? {
                                    ...entry,
                                    qty: convertDisplayQuantity(entry.qty, currentUnit, nextUnit),
                                    unit: nextUnit,
                                  }
                                : entry
                            )
                          )
                          setResult(null)
                        }}
                        disabled={!selected}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {selected &&
                              compatibleUnits(selected.unit).map((unit) => (
                                <SelectItem key={unit} value={unit}>
                                  {unit}
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove estimate item"
                      title="Remove"
                      onClick={() => {
                        setBoms((current) => current.filter((_, i) => i !== index))
                        setResult(null)
                      }}
                    >
                      <X />
                    </Button>
                    {selected && (
                      <p className="text-xs text-muted-foreground sm:col-span-4">
                        {formatQuantity(bom.qty)} {bom.unit || selected.unit} ={' '}
                        {formatQuantity(
                          convertDisplayQuantity(bom.qty, bom.unit || selected.unit, selected.unit)
                        )}{' '}
                        {selected.unit} for costing at {formatMoney(selected.unitCost, currency)}{' '}
                        per {selected.unit}.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Extra cost per product (${currency})`}>
              <Input
                type="number"
                min={0}
                step="0.0001"
                value={extraCost}
                onChange={(event) => {
                  setExtraCost(event.target.value)
                  setResult(null)
                }}
              />
            </Field>
            <Field label="Markup on cost (%)">
              <Input
                type="number"
                min={0}
                max={1000}
                step="0.01"
                value={profitPct}
                placeholder="Use category default"
                onChange={(event) => {
                  setProfitPct(event.target.value)
                  setResult(null)
                }}
              />
            </Field>
          </div>
          {result && (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-4 text-sm">
              <div className="flex justify-between">
                <span>Materials/components</span>
                <span>{formatMoney(result.catalogCost, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Extra cost</span>
                <span>{formatMoney(result.extraCost, currency)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Estimated unit cost</span>
                <span>{formatMoney(result.estimatedUnitCost, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Suggested price excluding tax ({result.profitPct}% markup)</span>
                <span>{formatMoney(result.suggestedUnitPrice, currency)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span>Total for {quantity || 0}</span>
                <span>{formatMoney(result.suggestedUnitPrice * (quantity || 0), currency)}</span>
              </div>
              {result.boms.some((bom) => bom.zeroCost) && (
                <p className="text-xs text-destructive">
                  One or more items have a zero default cost. Review their catalog costs.
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={preview} disabled={loading}>
            {loading ? 'Calculating…' : 'Calculate'}
          </Button>
          <Button
            type="button"
            disabled={!result}
            onClick={() => {
              if (!result) return
              onApply(result, boms)
              setOpen(false)
            }}
          >
            Apply estimated price
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function QuotationNew({ customers, products, materials, components }: PageProps) {
  const currency = useCurrency()
  const { compatibleUnits, convertDisplayQuantity } = useMeasurementUnits()
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
        pricingMode: 'manual',
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
        pricingMode: 'manual',
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
    const newBoms = [...line.boms, { itemKind, itemId: firstId, qty: 1, unit: items[0]?.unit }]
    const newCost = computeBomCost(newBoms, materials, components, convertDisplayQuantity)
    setData(
      'items',
      data.items.map((l, i) =>
        i === lineIdx
          ? {
              ...l,
              boms: newBoms,
              unitCost: newCost,
              unitPrice: convertDisplayQuantity(
                computeCustomUnitPrice(newCost, l.profitPctOverride),
                l.unit ?? 'pcs',
                'pcs'
              ),
              pricingMode: 'manual',
              estimate: undefined,
              estimateTarget: undefined,
            }
          : l
      )
    )
  }

  const updateBom = (lineIdx: number, bomIdx: number, patch: Partial<BomDraft>) => {
    const line = data.items[lineIdx]
    const newBoms = line.boms.map((b, i) => (i === bomIdx ? { ...b, ...patch } : b))
    const newCost = computeBomCost(newBoms, materials, components, convertDisplayQuantity)
    setData(
      'items',
      data.items.map((l, i) =>
        i === lineIdx
          ? {
              ...l,
              boms: newBoms,
              unitCost: newCost,
              unitPrice: convertDisplayQuantity(
                computeCustomUnitPrice(newCost, l.profitPctOverride),
                l.unit ?? 'pcs',
                'pcs'
              ),
              pricingMode: 'manual',
              estimate: undefined,
              estimateTarget: undefined,
            }
          : l
      )
    )
  }

  const removeBom = (lineIdx: number, bomIdx: number) => {
    const line = data.items[lineIdx]
    const newBoms = line.boms.filter((_, i) => i !== bomIdx)
    const newCost = computeBomCost(newBoms, materials, components, convertDisplayQuantity)
    setData(
      'items',
      data.items.map((l, i) =>
        i === lineIdx
          ? {
              ...l,
              boms: newBoms,
              unitCost: newCost,
              unitPrice: convertDisplayQuantity(
                computeCustomUnitPrice(newCost, l.profitPctOverride),
                l.unit ?? 'pcs',
                'pcs'
              ),
              pricingMode: 'manual',
              estimate: undefined,
              estimateTarget: undefined,
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
                  <SelectGroup>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
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
                <SelectGroup>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectGroup>
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
                                aria-label={`Line ${i + 1} item name`}
                                value={ln.name}
                                placeholder={isCustom ? 'Product name' : ''}
                                onChange={(e) => updateLine(i, { name: e.target.value })}
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <EstimateDialog
                                  line={ln}
                                  quantity={convertDisplayQuantity(ln.qty, ln.unit ?? 'pcs', 'pcs')}
                                  materials={materials}
                                  components={components}
                                  onApply={(estimate, estimateBoms) =>
                                    updateLine(i, {
                                      boms: estimateBoms,
                                      unitCost: estimate.estimatedUnitCost,
                                      profitPctOverride: estimate.profitPct,
                                      unitPrice: convertDisplayQuantity(
                                        estimate.suggestedUnitPrice,
                                        ln.unit ?? 'pcs',
                                        'pcs'
                                      ),
                                      pricingMode: 'estimated',
                                      estimate: {
                                        extraCost: estimate.extraCost,
                                        profitPct: estimate.profitPct,
                                        expectedFingerprint: estimate.fingerprint,
                                      },
                                      estimateTarget: convertDisplayQuantity(
                                        estimate.suggestedUnitPrice,
                                        ln.unit ?? 'pcs',
                                        'pcs'
                                      ),
                                    })
                                  }
                                />
                                {ln.pricingMode === 'estimated' && (
                                  <Badge variant="secondary">
                                    Estimated cost {formatMoney(ln.unitCost ?? 0, currency)}
                                  </Badge>
                                )}
                              </div>
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
                                        const storedQty = item
                                          ? convertDisplayQuantity(
                                              bom.qty,
                                              bom.unit || item.unit,
                                              item.unit
                                            )
                                          : bom.qty
                                        const lineCost = storedQty * (item?.unitCost ?? 0)
                                        return (
                                          <div
                                            key={bi}
                                            className="grid grid-cols-[auto_minmax(8rem,1fr)_auto_auto_auto_auto] items-center gap-2"
                                          >
                                            <span className="text-[10px] font-medium uppercase text-muted-foreground">
                                              {bom.itemKind === 'material' ? 'Mat' : 'Cmp'}
                                            </span>
                                            <Select
                                              value={String(bom.itemId)}
                                              onValueChange={(v) => {
                                                const nextItem = itemList.find(
                                                  (candidate) => candidate.id === Number(v)
                                                )
                                                updateBom(i, bi, {
                                                  itemId: Number(v),
                                                  unit: nextItem?.unit,
                                                })
                                              }}
                                            >
                                              <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectGroup>
                                                  {itemList.map((it) => (
                                                    <SelectItem key={it.id} value={String(it.id)}>
                                                      {it.name}
                                                    </SelectItem>
                                                  ))}
                                                </SelectGroup>
                                              </SelectContent>
                                            </Select>
                                            <Input
                                              aria-label={`Line ${i + 1} BOM entry ${bi + 1} quantity`}
                                              placeholder="Qty"
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
                                            <Select
                                              value={bom.unit || item?.unit || ''}
                                              onValueChange={(nextUnit) => {
                                                const currentUnit =
                                                  bom.unit || item?.unit || nextUnit
                                                updateBom(i, bi, {
                                                  qty: convertDisplayQuantity(
                                                    bom.qty,
                                                    currentUnit,
                                                    nextUnit
                                                  ),
                                                  unit: nextUnit,
                                                })
                                              }}
                                              disabled={!item}
                                            >
                                              <SelectTrigger className="h-8 w-20 text-xs">
                                                <SelectValue placeholder="Unit" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectGroup>
                                                  {item &&
                                                    compatibleUnits(item.unit).map((unit) => (
                                                      <SelectItem key={unit} value={unit}>
                                                        {unit}
                                                      </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                              </SelectContent>
                                            </Select>
                                            <span className="w-16 text-right text-xs text-muted-foreground">
                                              {formatMoney(lineCost, currency)}
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
                              aria-label={`Line ${i + 1} quantity`}
                              placeholder="Qty"
                              type="number"
                              step="any"
                              value={ln.qty}
                              onChange={(e) => updateLine(i, { qty: Number(e.target.value) })}
                              className="w-20"
                            />
                            <QuantityUnitSelect
                              label={`Line ${i + 1} quantity unit`}
                              value={ln.unit ?? 'pcs'}
                              onChange={(unit) =>
                                updateLine(i, {
                                  unit,
                                  qty: Number(
                                    convertDisplayQuantity(ln.qty, ln.unit ?? 'pcs', unit).toFixed(
                                      9
                                    )
                                  ),
                                  unitPrice:
                                    ln.unitPrice === undefined
                                      ? undefined
                                      : convertDisplayQuantity(
                                          ln.unitPrice,
                                          unit,
                                          ln.unit ?? 'pcs'
                                        ),
                                  estimateTarget:
                                    ln.estimateTarget === undefined
                                      ? undefined
                                      : convertDisplayQuantity(
                                          ln.estimateTarget,
                                          unit,
                                          ln.unit ?? 'pcs'
                                        ),
                                })
                              }
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            {isCustom ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm tabular-nums">
                                  {formatMoney(ln.unitCost ?? 0, currency)}
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
                                aria-label={`Line ${i + 1} profit percent`}
                                placeholder="Profit %"
                                type="number"
                                step="0.01"
                                value={ln.profitPctOverride ?? ''}
                                onChange={(e) => {
                                  const profit = e.target.value ? Number(e.target.value) : undefined
                                  updateLine(i, {
                                    profitPctOverride: profit,
                                    unitPrice: convertDisplayQuantity(
                                      computeCustomUnitPrice(ln.unitCost, profit),
                                      ln.unit ?? 'pcs',
                                      'pcs'
                                    ),
                                    pricingMode: 'manual',
                                    estimate: undefined,
                                    estimateTarget: undefined,
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
                              onChange={(e) =>
                                updateLine(i, {
                                  unitPrice: e.target.value ? Number(e.target.value) : undefined,
                                  pricingMode: 'manual',
                                })
                              }
                              className="w-28"
                            />
                            {ln.pricingMode === 'manual' &&
                              ln.estimateTarget !== undefined &&
                              Number(ln.unitPrice ?? 0) < ln.estimateTarget && (
                                <p className="mt-1 w-32 text-xs text-destructive">
                                  Below estimated target of{' '}
                                  {formatMoney(ln.estimateTarget, currency)}
                                </p>
                              )}
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Tax %"
                              value={ln.taxRatePct}
                              onChange={(e) =>
                                updateLine(i, { taxRatePct: Number(e.target.value) })
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell className="align-top text-right tabular-nums">
                            {formatMoney(lto, currency)}
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
                    <span className="tabular-nums">
                      {formatMoney(subtotals.subtotal, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="tabular-nums">{formatMoney(subtotals.tax, currency)}</span>
                  </div>
                  <div className="mt-1 flex justify-between border-t pt-2 text-base font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{formatMoney(subtotals.total, currency)}</span>
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
