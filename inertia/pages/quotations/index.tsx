import { type ReactElement, useState } from 'react'
import { useForm, router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { CheckCircle2, ExternalLink, FileText, Send, Trash2 } from 'lucide-react'
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
import {
  ColumnVisibilityMenu,
  type ColumnDef,
} from '@/components/data-table/column-visibility'
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

type Filters = { q: string; status: string; customerId: string }

type PageProps = {
  quotations: QuotationRow[]
  customers: CustomerOpt[]
  products: ProductOpt[]
  filters: Filters
}

type LineDraft = {
  productId?: number
  description: string
  qty: number
  unitPrice?: number
  profitPctOverride?: number
  taxRatePct: number
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
}: {
  customers: CustomerOpt[]
  products: ProductOpt[]
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
        description: `${p.name} (${p.sku})`,
        qty: 1,
        unitPrice: p.suggestedUnitPrice,
        profitPctOverride: p.profitPct,
        taxRatePct: p.taxRatePct,
      },
    ])
  }

  const addCustomLine = () =>
    setData('items', [
      ...data.items,
      { description: '', qty: 1, unitPrice: 0, taxRatePct: 18 },
    ])

  const updateLine = (idx: number, patch: Partial<LineDraft>) =>
    setData(
      'items',
      data.items.map((l, i) => (i === idx ? { ...l, ...patch } : l))
    )

  const subtotals = data.items.reduce(
    (acc, ln) => {
      const ls = Math.round((ln.qty || 0) * (ln.unitPrice || 0) * 100) / 100
      const lt = Math.round((ls * (ln.taxRatePct || 0)) / 100 * 100) / 100
      acc.subtotal += ls
      acc.tax += lt
      acc.total += ls + lt
      return acc
    },
    { subtotal: 0, tax: 0, total: 0 }
  )

  const removeLine = (idx: number) =>
    setData('items', data.items.filter((_, i) => i !== idx))

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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create quotation</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer" error={errors.customerId}>
              <Select
                value={data.customerId}
                onValueChange={(v) => setData('customerId', v)}
              >
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
            <Input
              value={data.note}
              onChange={(e) => setData('note', e.target.value)}
            />
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
                      <TableHead>Description</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit price</TableHead>
                      <TableHead>Tax %</TableHead>
                      <TableHead className="text-right">Line total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((ln, i) => {
                      const ls = Math.round((ln.qty || 0) * (ln.unitPrice || 0) * 100) / 100
                      const lt =
                        Math.round((ls * (ln.taxRatePct || 0)) / 100 * 100) / 100
                      const lto = Math.round((ls + lt) * 100) / 100
                      return (
                        <TableRow key={i}>
                          <TableCell>
                            <Input
                              value={ln.description}
                              onChange={(e) =>
                                updateLine(i, { description: e.target.value })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={ln.qty}
                              onChange={(e) =>
                                updateLine(i, { qty: Number(e.target.value) })
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.0001"
                              value={ln.unitPrice ?? ''}
                              placeholder={ln.productId ? 'auto' : '0'}
                              onChange={(e) =>
                                updateLine(i, {
                                  unitPrice: e.target.value
                                    ? Number(e.target.value)
                                    : undefined,
                                })
                              }
                              className="w-28"
                            />
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
                          <TableCell className="text-right tabular-nums">
                            ₹{lto.toFixed(2)}
                          </TableCell>
                          <TableCell>
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
              disabled={
                processing || !data.customerId || data.items.length === 0
              }
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
  filters,
}: PageProps) {
  // Use router for type checking suppression
  void router
  const { isVisible, toggle, reset } = useColumnVisibility('quotations')
  const totalValue = quotations.reduce((s, q) => s + Number(q.total || 0), 0)
  const accepted = quotations.filter((q) => q.status === 'accepted' || q.status === 'converted').length
  const draftSent = quotations.filter((q) => q.status === 'draft' || q.status === 'sent').length
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Quotations</h1>
        </div>
        <div className="flex items-center gap-2">
          <NewQuotationDialog customers={customers} products={products} />
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
                  {isVisible('total') && (
                    <TableHead className="text-right">Total</TableHead>
                  )}
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
                    {isVisible('total') && (
                      <TableCell className="text-right">{q.total}</TableCell>
                    )}
                    {isVisible('actions') && (
                      <TableCell className="text-right">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          aria-label="Open quotation"
                        >
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
