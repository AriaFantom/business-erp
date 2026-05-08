import { type ReactElement, useState } from 'react'
import { useForm } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

type Sale = {
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
}

type Invoice = {
  id: number
  number: string
  status: string
  total: string
  paidTotal: string
}

type PageProps = { sale: Sale; items: Item[]; invoice: Invoice | null }

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

export default function SaleShow({ sale, items, invoice }: PageProps) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sale {sale.number}</h1>
          <p className="text-sm text-muted-foreground">
            {sale.customer?.name ?? '—'}
            {sale.quotationId ? ` · from quotation #${sale.quotationId}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{sale.status}</Badge>
          {sale.status === 'draft' && (
            <>
              <PostAction
                path={`/sales/${sale.id}/confirm`}
                label="Confirm & invoice"
                confirmText="Confirm sale and issue invoice?"
              />
              <PostAction
                path={`/sales/${sale.id}/cancel`}
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
            <dd className="text-right">{sale.subtotal}</dd>
            <dt className="text-muted-foreground">Tax</dt>
            <dd className="text-right">{sale.taxTotal}</dd>
            <dt className="font-medium">Total</dt>
            <dd className="text-right font-medium">{sale.total}</dd>
          </dl>
          {sale.note && (
            <p className="mt-3 text-sm text-muted-foreground">{sale.note}</p>
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
                  {invoice.paidTotal} / {invoice.total} paid · {invoice.status}
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
    </div>
  )
}

SaleShow.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
