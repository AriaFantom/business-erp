import { type ReactElement, useState } from 'react'
import { Link, useForm, router } from '@inertiajs/react'
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
  defaultProfitPct: string | null
  taxRatePct: string | null
}

type PageProps = {
  quotations: QuotationRow[]
  customers: CustomerOpt[]
  products: ProductOpt[]
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
        description: p.name,
        qty: 1,
        taxRatePct: p.taxRatePct ? Number(p.taxRatePct) : 18,
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
      <DialogContent className="max-w-3xl">
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
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-medium">Add line:</span>
              <Select onValueChange={(v) => addProductLine(Number(v))}>
                <SelectTrigger className="w-64">
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

            {data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lines.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit price</TableHead>
                    <TableHead>Profit %</TableHead>
                    <TableHead>Tax %</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((ln, i) => (
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
                          value={ln.profitPctOverride ?? ''}
                          placeholder="default"
                          onChange={(e) =>
                            updateLine(i, {
                              profitPctOverride: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            })
                          }
                          className="w-20"
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
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(i)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button
              type="submit"
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

export default function QuotationsIndex({
  quotations,
  customers,
  products,
}: PageProps) {
  // Use router for type checking suppression
  void router
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Quotations</h1>
          <p className="text-sm text-muted-foreground">{quotations.length} quotations.</p>
        </div>
        <NewQuotationDialog customers={customers} products={products} />
      </div>

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
                  <TableHead>Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Valid until</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotations.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">{q.number}</TableCell>
                    <TableCell>{q.customerName}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(q.status)}>{q.status}</Badge>
                    </TableCell>
                    <TableCell>{q.issuedAt?.slice(0, 10) ?? '—'}</TableCell>
                    <TableCell>{q.validUntil?.slice(0, 10) ?? '—'}</TableCell>
                    <TableCell className="text-right">{q.total}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/quotations/${q.id}`}
                        className="text-sm underline-offset-2 hover:underline"
                      >
                        Open
                      </Link>
                    </TableCell>
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
