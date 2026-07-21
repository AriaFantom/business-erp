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
import { Download } from 'lucide-react'

type Invoice = {
  id: number
  number: string
  orderId: number
  status: string
  issuedAt: string | null
  dueAt: string | null
  subtotal: string
  taxTotal: string
  total: string
  paidTotal: string
  creditTotal: string
  customer: { id: number; name: string } | null
  replacesInvoiceId: number | null
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
}

type Payment = {
  id: number
  amount: string
  method: string
  paidAt: string | null
  reference: string | null
}

type CreditNote = {
  id: number
  orderId: number
  number: string
  createdAt: string | null
  total: string
  creditApplied: string
  refundAmount: string
  refundMethod: string | null
}

type PageProps = {
  invoice: Invoice
  items: Item[]
  payments: Payment[]
  creditNotes: CreditNote[]
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

function PaymentDialog({ invoiceId, due }: { invoiceId: number; due: number }) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset } = useForm({
    amount: due,
    method: 'bank',
    paidAt: new Date().toISOString().slice(0, 10),
    reference: '',
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Record payment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            post(`/invoices/${invoiceId}/payments`, {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setOpen(false)
              },
            })
          }}
        >
          <Field label={`Amount (due ₹${due.toFixed(2)})`} error={errors.amount}>
            <Input
              type="number"
              step="0.01"
              value={data.amount}
              onChange={(e) => setData('amount', Number(e.target.value))}
            />
          </Field>
          <Field label="Method" error={errors.method}>
            <Select value={data.method} onValueChange={(v) => setData('method', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">cash</SelectItem>
                <SelectItem value="bank">bank</SelectItem>
                <SelectItem value="upi">upi</SelectItem>
                <SelectItem value="other">other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Paid on" error={errors.paidAt}>
            <Input
              type="date"
              value={data.paidAt}
              onChange={(e) => setData('paidAt', e.target.value)}
            />
          </Field>
          <Field label="Reference" error={errors.reference}>
            <Input
              value={data.reference}
              onChange={(e) => setData('reference', e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={processing}>
              {processing ? 'Saving…' : 'Record'}
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

export default function InvoiceShow({ invoice, items, payments, creditNotes }: PageProps) {
  const due = Math.max(
    0,
    Number(invoice.total) - Number(invoice.paidTotal) - Number(invoice.creditTotal)
  )
  const canPay = invoice.status === 'unpaid' || invoice.status === 'partial'
  const canVoid =
    invoice.status !== 'void' && payments.length === 0 && Number(invoice.creditTotal) === 0

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Invoice {invoice.number}</h1>
          <p className="text-sm text-muted-foreground">
            {invoice.customer?.name ?? '—'} ·{' '}
            <Link
              href={`/orders/${invoice.orderId}`}
              className="underline-offset-2 hover:underline"
            >
              order #{invoice.orderId}
            </Link>{' '}
            · due {invoice.dueAt?.slice(0, 10) ?? '—'}
            {invoice.replacesInvoiceId ? (
              <>
                {' · '}
                <Link
                  href={`/invoices/${invoice.replacesInvoiceId}`}
                  className="underline-offset-2 hover:underline"
                >
                  replaces #{invoice.replacesInvoiceId}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge kind="invoice" status={invoice.status} />
          <Button asChild variant="outline">
            <a href={`/invoices/${invoice.id}/download`}>
              <Download className="size-4" />
              Download PDF
            </a>
          </Button>
          {canPay && <PaymentDialog invoiceId={invoice.id} due={due} />}
          {canVoid && (
            <PostAction
              path={`/invoices/${invoice.id}/void`}
              label="Void"
              variant="destructive"
              confirmText="Void this invoice? This cannot be undone."
            />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
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
                  <TableCell className="text-right">{it.unitPrice}</TableCell>
                  <TableCell className="text-right">{it.taxRatePct}</TableCell>
                  <TableCell className="text-right">{it.lineSubtotal}</TableCell>
                  <TableCell className="text-right">{it.lineTax}</TableCell>
                  <TableCell className="text-right">{it.lineTotal}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="text-right">{invoice.subtotal}</dd>
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="text-right">{invoice.taxTotal}</dd>
              <dt className="font-medium">Total</dt>
              <dd className="text-right font-medium">{invoice.total}</dd>
              <dt className="text-muted-foreground">Paid</dt>
              <dd className="text-right">{invoice.paidTotal}</dd>
              <dt className="text-muted-foreground">Credit notes</dt>
              <dd className="text-right">{invoice.creditTotal}</dd>
              <dt className="font-medium">Due</dt>
              <dd className="text-right font-medium">{due.toFixed(2)}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">None recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.paidAt?.slice(0, 10) ?? '—'}</TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell className="text-right">{p.amount}</TableCell>
                      <TableCell>{p.reference ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {creditNotes.length > 0 && (
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
                {creditNotes.map((cn) => (
                  <TableRow key={cn.id}>
                    <TableCell className="font-mono text-sm">{cn.number}</TableCell>
                    <TableCell>{cn.createdAt?.slice(0, 10) ?? '—'}</TableCell>
                    <TableCell className="text-right">{cn.total}</TableCell>
                    <TableCell className="text-right">{cn.creditApplied}</TableCell>
                    <TableCell className="text-right">{cn.refundAmount}</TableCell>
                    <TableCell>{cn.refundMethod ?? '—'}</TableCell>
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

InvoiceShow.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
