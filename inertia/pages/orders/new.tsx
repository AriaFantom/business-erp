import { type ReactElement } from 'react'
import { Head, useForm } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { ChevronLeft, Package, Plus, Trash2 } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
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
import DashboardLayout from '@/layouts/dashboard-layout'

type CustomerOpt = { id: number; name: string }
type ProductOpt = {
  id: number
  sku: string
  name: string
  taxRatePct: number
  suggestedUnitPrice: number
}

type PageProps = {
  customers: CustomerOpt[]
  products: ProductOpt[]
}

type LineDraft = {
  productId?: number
  description: string
  qty: number
  unitPrice: number
  taxRatePct: number
}

export default function OrderNew({ customers, products }: PageProps) {
  const { data, setData, post, processing, errors } = useForm({
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
        // Server-suggested price; edits are server-enforced (override
        // permission required, floored at cost). Tax is server-derived.
        unitPrice: p.suggestedUnitPrice,
        taxRatePct: p.taxRatePct,
      },
    ])
  }

  const addCustomLine = () =>
    setData('items', [...data.items, { description: '', qty: 1, unitPrice: 0, taxRatePct: 18 }])

  const updateLine = (idx: number, patch: Partial<LineDraft>) =>
    setData(
      'items',
      data.items.map((l, i) => (i === idx ? { ...l, ...patch } : l))
    )

  const removeLine = (idx: number) =>
    setData(
      'items',
      data.items.filter((_, i) => i !== idx)
    )

  // Client-side estimate; the server recomputes and is the source of truth.
  const subtotal = data.items.reduce((sum, l) => sum + Number(l.qty || 0) * Number(l.unitPrice || 0), 0)
  const tax = data.items.reduce(
    (sum, l) => sum + (Number(l.qty || 0) * Number(l.unitPrice || 0) * Number(l.taxRatePct || 0)) / 100,
    0
  )
  const total = subtotal + tax
  const money = (n: number) => `₹${n.toFixed(2)}`

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    post('/orders', { preserveScroll: true })
  }

  const canSubmit = !!data.customerId && data.items.length > 0

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-6 px-6 py-8">
      <Head title="New order" />
      <div>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to orders
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">New order</h1>
        <p className="text-sm text-muted-foreground">
          Pick a customer, add product or custom lines, then create a draft order.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Who the order is for and any note.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Customer" error={errors.customerId} required>
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
            <Field label="Note" error={errors.note}>
              <Textarea
                value={data.note}
                onChange={(e) => setData('note', e.target.value)}
                rows={1}
                placeholder="Optional"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>
            Add products at their suggested price, or a custom line. Tax on product lines is derived
            on the server.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value="" onValueChange={(v) => addProductLine(Number(v))}>
              <SelectTrigger className="w-full sm:w-72">
                <Package className="size-4" />
                <SelectValue placeholder="Add product…" />
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
              <Plus className="size-4" /> Add custom item
            </Button>
          </div>

          {errors.items && <span className="text-xs text-destructive">{errors.items}</span>}

          {data.items.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No items yet. Add a product or a custom line to begin.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-32">Unit price</TableHead>
                  <TableHead className="w-24">Tax %</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((ln, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Input
                        value={ln.description}
                        onChange={(e) => updateLine(i, { description: e.target.value })}
                        placeholder="Description"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={ln.qty}
                        onChange={(e) => updateLine(i, { qty: Number(e.target.value) })}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.0001"
                        value={ln.unitPrice}
                        onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) })}
                        className="w-28"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={ln.taxRatePct}
                        disabled={!!ln.productId}
                        title={
                          ln.productId
                            ? 'Tax on product lines is derived on the server.'
                            : undefined
                        }
                        onChange={(e) => updateLine(i, { taxRatePct: Number(e.target.value) })}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove line"
                        onClick={() => removeLine(i)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {data.items.length > 0 && (
            <div className="flex justify-end">
              <dl className="w-full max-w-xs space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular-nums">{money(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd className="tabular-nums">{money(tax)}</dd>
                </div>
                <div className="flex justify-between border-t pt-1 font-medium">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{money(total)}</dd>
                </div>
                <p className="pt-1 text-xs text-muted-foreground">
                  Estimate — the server recomputes the final totals.
                </p>
              </dl>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-6 flex items-center justify-end gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur">
        <Link href="/orders">
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
        <Button type="submit" variant="success" disabled={processing || !canSubmit}>
          {processing ? 'Creating…' : 'Create order'}
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

OrderNew.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
