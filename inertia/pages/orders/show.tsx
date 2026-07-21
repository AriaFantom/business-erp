import { type ReactElement, useState } from 'react'
import { useForm } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
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
import DashboardLayout from '@/layouts/dashboard-layout'

type Order = {
  id: number
  number: string
  status: string
  customer: { id: number; name: string } | null
  subtotal: string
  taxTotal: string
  total: string
  note: string | null
  confirmedAt: string | null
  quotationId: number | null
}

type Item = {
  id: number
  productId: number | null
  description: string
  qty: number
  unitPrice: string
  taxRatePct: string
  lineSubtotal: string
  lineTax: string
  lineTotal: string
  returnedQty: number
}

type Invoice = {
  id: number
  number: string
  status: string
  total: string
  paidTotal: string
  creditTotal: string
}

type OrderReturn = {
  id: number
  number: string
  createdAt: string | null
  total: string
  creditApplied: string
  refundAmount: string
  refundMethod: string | null
  note: string | null
}

type PageProps = {
  order: Order
  items: Item[]
  invoice: Invoice | null
  returns: OrderReturn[]
}

function PostAction({
  path,
  label,
  variant = 'default',
  confirmText,
}: {
  path: string
  label: string
  variant?: 'default' | 'destructive' | 'outline'
  confirmText?: string
}) {
  const { post, processing } = useForm()
  const [open, setOpen] = useState(false)
  const submit = () => post(path, { preserveScroll: true })
  return (
    <>
      <Button
        variant={variant}
        disabled={processing}
        onClick={() => (confirmText ? setOpen(true) : submit())}
      >
        {label}
      </Button>
      {confirmText && (
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title={confirmText}
          confirmLabel={label}
          variant={variant === 'destructive' ? 'destructive' : 'default'}
          onConfirm={submit}
        />
      )}
    </>
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function ReturnDialog({
  orderId,
  items,
  invoice,
}: {
  orderId: number
  items: Item[]
  invoice: Invoice | null
}) {
  const [open, setOpen] = useState(false)
  const returnable = items.filter((it) => it.qty - it.returnedQty > 0)
  const { data, setData, post, processing, transform, reset } = useForm<{
    qtyByItem: Record<number, string>
    refundMethod: string
    note: string
  }>({ qtyByItem: {}, refundMethod: '', note: '' })

  transform((d) => ({
    items: Object.entries(d.qtyByItem)
      .map(([id, qty]) => ({ orderItemId: Number(id), qty: Number(qty) }))
      .filter((l) => Number.isInteger(l.qty) && l.qty > 0),
    refundMethod: d.refundMethod || undefined,
    note: d.note.trim() || undefined,
  }))

  // Client-side estimate of the credit/refund split — the server recomputes
  // and enforces this; it only drives the "refund method required" hint.
  const returnTotal = round2(
    returnable.reduce((sum, it) => {
      const qty = Number(data.qtyByItem[it.id] ?? 0)
      if (!(qty > 0)) return sum
      const subtotal = round2(qty * Number(it.unitPrice))
      const tax = round2((subtotal * Number(it.taxRatePct)) / 100)
      return sum + subtotal + tax
    }, 0)
  )
  const remainingDue =
    invoice && invoice.status !== 'void'
      ? Math.max(
          0,
          round2(Number(invoice.total) - Number(invoice.paidTotal) - Number(invoice.creditTotal))
        )
      : 0
  const estCredit = Math.min(returnTotal, remainingDue)
  const estRefund = round2(returnTotal - estCredit)
  const anyQty = returnTotal > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={returnable.length === 0}>
          Return / credit note
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Return items &amp; issue credit note</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            post(`/orders/${orderId}/returns`, {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setOpen(false)
              },
            })
          }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Sold</TableHead>
                <TableHead className="text-right">Returned</TableHead>
                <TableHead className="text-right">Return qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returnable.map((it) => {
                const remaining = it.qty - it.returnedQty
                return (
                  <TableRow key={it.id}>
                    <TableCell>{it.description}</TableCell>
                    <TableCell className="text-right">{it.qty}</TableCell>
                    <TableCell className="text-right">{it.returnedQty}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        max={remaining}
                        step={1}
                        className="ml-auto w-24 text-right"
                        value={data.qtyByItem[it.id] ?? ''}
                        placeholder="0"
                        onChange={(e) =>
                          setData('qtyByItem', { ...data.qtyByItem, [it.id]: e.target.value })
                        }
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {anyQty && (
            <div className="rounded-md border p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credit note total</span>
                <span>{returnTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Applied to invoice</span>
                <span>{estCredit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Refund owed</span>
                <span>{estRefund.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label>
              Refund method{estRefund > 0 ? ' (required)' : ' (only if a refund is owed)'}
            </Label>
            <Select
              value={data.refundMethod}
              onValueChange={(v) => setData('refundMethod', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">cash</SelectItem>
                <SelectItem value="bank">bank</SelectItem>
                <SelectItem value="upi">upi</SelectItem>
                <SelectItem value="other">other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Note</Label>
            <Input
              value={data.note}
              placeholder="Reason (optional)"
              onChange={(e) => setData('note', e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={processing || !anyQty || (estRefund > 0 && !data.refundMethod)}
            >
              {processing ? 'Saving…' : 'Issue credit note'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function OrderShow({ order, items, invoice, returns }: PageProps) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Order {order.number}</h1>
          <p className="text-sm text-muted-foreground">
            {order.customer?.name ?? '—'}
            {order.quotationId ? (
              <>
                {' · from '}
                <Link
                  href={`/quotations/${order.quotationId}`}
                  className="underline-offset-2 hover:underline"
                >
                  quotation #{order.quotationId}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge kind="order" status={order.status} />
          {order.status === 'confirmed' && (
            <ReturnDialog orderId={order.id} items={items} invoice={invoice} />
          )}
          {order.status === 'draft' && (
            <>
              <PostAction
                path={`/orders/${order.id}/confirm`}
                label="Confirm & invoice"
                confirmText="Confirm order and issue invoice?"
              />
              <PostAction
                path={`/orders/${order.id}/cancel`}
                label="Cancel"
                variant="destructive"
                confirmText="Cancel this draft?"
              />
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lines</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Returned</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Tax %</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.description}</TableCell>
                    <TableCell className="text-right">{it.qty}</TableCell>
                    <TableCell className="text-right">
                      {it.returnedQty > 0 ? it.returnedQty : '—'}
                    </TableCell>
                    <TableCell className="text-right">{it.unitPrice}</TableCell>
                    <TableCell className="text-right">{it.taxRatePct}</TableCell>
                    <TableCell className="text-right">{it.lineSubtotal}</TableCell>
                    <TableCell className="text-right">{it.lineTax}</TableCell>
                    <TableCell className="text-right">{it.lineTotal}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="text-right">{order.subtotal}</dd>
            <dt className="text-muted-foreground">Tax</dt>
            <dd className="text-right">{order.taxTotal}</dd>
            <dt className="font-medium">Total</dt>
            <dd className="text-right font-medium">{order.total}</dd>
          </dl>
          {order.note && (
            <p className="mt-3 text-sm text-muted-foreground">{order.note}</p>
          )}
        </CardContent>
      </Card>

      {invoice && (
        <Card>
          <CardHeader>
            <CardTitle>Invoice</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-sm">{invoice.number}</div>
                <div className="text-xs text-muted-foreground">
                  {invoice.paidTotal} / {invoice.total} paid
                  {Number(invoice.creditTotal) > 0 ? ` · ${invoice.creditTotal} credited` : ''}
                  {' · '}
                  {invoice.status}
                </div>
              </div>
              <Link
                href={`/invoices/${invoice.id}`}
                className="text-sm underline-offset-2 hover:underline"
              >
                Open invoice →
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {returns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Credit notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Credit applied</TableHead>
                  <TableHead className="text-right">Refunded</TableHead>
                  <TableHead>Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.number}</TableCell>
                    <TableCell>{r.createdAt?.slice(0, 10) ?? '—'}</TableCell>
                    <TableCell className="text-right">{r.total}</TableCell>
                    <TableCell className="text-right">{r.creditApplied}</TableCell>
                    <TableCell className="text-right">{r.refundAmount}</TableCell>
                    <TableCell>{r.refundMethod ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

OrderShow.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
