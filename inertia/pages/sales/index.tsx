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
import { Badge } from '@/components/ui/badge'
import DashboardLayout from '@/layouts/dashboard-layout'
import { ListToolbar } from '@/components/catalog/list-toolbar'

type SaleRow = {
  id: number
  number: string
  customerId: number
  customerName: string
  status: string
  total: string
  confirmedAt: string | null
  quotationId: number | null
}

type CustomerOpt = { id: number; name: string }
type ProductOpt = { id: number; sku: string; name: string; taxRatePct: string | null }

type Filters = { q: string; status: string; customerId: string }

type PageProps = {
  sales: SaleRow[]
  customers: CustomerOpt[]
  products: ProductOpt[]
  filters: Filters
}

type LineDraft = {
  productId?: number
  description: string
  qty: number
  unitPrice: number
  taxRatePct: number
}

function statusVariant(s: string) {
  if (s === 'confirmed') return 'default' as const
  if (s === 'cancelled') return 'destructive' as const
  return 'outline' as const
}

function NewSaleDialog({
  customers,
  products,
}: {
  customers: CustomerOpt[]
  products: ProductOpt[]
}) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset } = useForm({
    customerId: '',
    note: '',
    items: [] as LineDraft[],
  })

  const addProductLine = (id: number) => {
    const p = products.find((x) => x.id === id)
    if (!p) return
    setData('items', [
      ...data.items,
      {
        productId: id,
        description: p.name,
        qty: 1,
        unitPrice: 0,
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
    post('/sales', {
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
        <Button>New sale</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create sale</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={submit}>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit price</TableHead>
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
                          value={ln.unitPrice}
                          onChange={(e) =>
                            updateLine(i, { unitPrice: Number(e.target.value) })
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

export default function SalesIndex({ sales, customers, products, filters }: PageProps) {
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sales</h1>
          <p className="text-sm text-muted-foreground">{sales.length} sales.</p>
        </div>
        <NewSaleDialog customers={customers} products={products} />
      </div>

      <ListToolbar
        basePath="/sales"
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
          <CardTitle>All sales</CardTitle>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Confirmed</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.number}</TableCell>
                    <TableCell>{s.customerName}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{s.total}</TableCell>
                    <TableCell>{s.confirmedAt?.slice(0, 10) ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/sales/${s.id}`}
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

SalesIndex.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
