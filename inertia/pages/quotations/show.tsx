import { type ReactElement, useState } from 'react'
import { useForm } from '@inertiajs/react'
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
import { Download } from 'lucide-react'

type Quotation = {
  id: number
  number: string
  status: string
  customer: { id: number; name: string } | null
  issuedAt: string | null
  validUntil: string | null
  subtotal: string
  taxTotal: string
  total: string
  note: string | null
  sentAt: string | null
  acceptedAt: string | null
  rejectedAt: string | null
  convertedToSaleId: number | null
}

type Item = {
  id: number
  productId: number | null
  productName: string | null
  description: string
  qty: number
  unitPrice: string
  profitPctUsed: string | null
  taxRatePct: string
  lineSubtotal: string
  lineTax: string
  lineTotal: string
}

type PageProps = { quotation: Quotation; items: Item[] }

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

export default function QuotationShow({ quotation, items }: PageProps) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Quotation {quotation.number}</h1>
          <p className="text-sm text-muted-foreground">
            {quotation.customer?.name ?? '—'} · valid until{' '}
            {quotation.validUntil?.slice(0, 10) ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{quotation.status}</Badge>
          <Button asChild variant="outline">
            <a href={`/quotations/${quotation.id}/download`}>
              <Download className="size-4" />
              Download PDF
            </a>
          </Button>
          {quotation.status === 'draft' && (
            <PostAction path={`/quotations/${quotation.id}/send`} label="Send" />
          )}
          {quotation.status === 'sent' && (
            <>
              <PostAction
                path={`/quotations/${quotation.id}/accept`}
                label="Accept"
              />
              <PostAction
                path={`/quotations/${quotation.id}/reject`}
                label="Reject"
                variant="destructive"
                confirmText="Reject this quotation?"
              />
            </>
          )}
          {quotation.status === 'accepted' && (
            <PostAction
              path={`/quotations/${quotation.id}/convert`}
              label="Convert to sale"
              confirmText="Create a sale from this quotation?"
            />
          )}
          {quotation.status === 'converted' && quotation.convertedToSaleId && (
            <a
              href={`/sales/${quotation.convertedToSaleId}`}
              className="text-sm underline-offset-2 hover:underline"
            >
              View sale →
            </a>
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
                  <TableHead>Product</TableHead>
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
                    <TableCell>{it.productName ?? '—'}</TableCell>
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
            <dd className="text-right">{quotation.subtotal}</dd>
            <dt className="text-muted-foreground">Tax</dt>
            <dd className="text-right">{quotation.taxTotal}</dd>
            <dt className="font-medium">Total</dt>
            <dd className="text-right font-medium">{quotation.total}</dd>
          </dl>
          {quotation.note && (
            <p className="mt-3 text-sm text-muted-foreground">{quotation.note}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

QuotationShow.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
