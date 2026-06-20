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
import { StatusBadge } from '@/components/status-badge'
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

type BomEntry = {
  id: number
  itemKind: string
  itemId: number
  itemName: string
  qty: string
  unitCostAtTime: string
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
  boms: BomEntry[]
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
          <StatusBadge kind="quotation" status={quotation.status} />
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
              <PostAction path={`/quotations/${quotation.id}/accept`} label="Accept" />
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
            <div className="flex flex-col gap-4">
              {items.map((it) => (
                <div key={it.id} className="rounded border p-3">
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-6">
                    <div className="col-span-2 lg:col-span-2">
                      <span className="text-xs text-muted-foreground">Description</span>
                      <p className="font-medium">{it.description}</p>
                      {it.productName && (
                        <p className="text-xs text-muted-foreground">Product: {it.productName}</p>
                      )}
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Qty</span>
                      <p>{it.qty}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Unit price</span>
                      <p>₹{Number(it.unitPrice).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Tax %</span>
                      <p>{Number(it.taxRatePct).toFixed(2)}%</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Line total</span>
                      <p className="font-medium">₹{Number(it.lineTotal).toFixed(2)}</p>
                    </div>
                  </div>

                  {it.boms.length > 0 && (
                    <div className="mt-3 border-t pt-2">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Cost breakdown (internal)
                      </p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Type</TableHead>
                            <TableHead className="text-xs">Item</TableHead>
                            <TableHead className="text-xs text-right">Qty</TableHead>
                            <TableHead className="text-xs text-right">Unit cost</TableHead>
                            <TableHead className="text-xs text-right">Line cost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {it.boms.map((bom) => {
                            const lineCost = Number(bom.qty) * Number(bom.unitCostAtTime)
                            return (
                              <TableRow key={bom.id}>
                                <TableCell className="text-xs capitalize">{bom.itemKind}</TableCell>
                                <TableCell className="text-xs">{bom.itemName}</TableCell>
                                <TableCell className="text-right text-xs">
                                  {Number(bom.qty).toFixed(4)}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  ₹{Number(bom.unitCostAtTime).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  ₹{lineCost.toFixed(2)}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                      <div className="mt-1 flex justify-between text-xs">
                        <span className="text-muted-foreground">Cost basis</span>
                        <span className="tabular-nums">
                          ₹
                          {it.boms
                            .reduce((s, b) => s + Number(b.qty) * Number(b.unitCostAtTime), 0)
                            .toFixed(2)}
                        </span>
                      </div>
                      {it.profitPctUsed && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Profit applied</span>
                          <span className="tabular-nums">
                            {Number(it.profitPctUsed).toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
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
          {quotation.note && <p className="mt-3 text-sm text-muted-foreground">{quotation.note}</p>}
        </CardContent>
      </Card>
    </div>
  )
}

QuotationShow.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
