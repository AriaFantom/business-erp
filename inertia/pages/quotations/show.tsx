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
import { formatMoney, useCurrency } from '@/lib/currency'

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
  convertedToOrderId: number | null
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
  measurementSnapshot?: { unit: string; quantity: string; unitPrice: string } | null
  profitPctUsed: string | null
  taxRatePct: string
  lineSubtotal: string
  lineTax: string
  lineTotal: string
  pricingBasis: string | null
  estimatedMaterialCost: string | null
  estimatedComponentCost: string | null
  estimatedExtraCost: string | null
  estimatedUnitCost: string | null
  estimatedProfitPct: string | null
  estimatedSuggestedUnitPrice: string | null
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
  const currency = useCurrency()
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
              label="Convert to order"
              confirmText="Create an order from this quotation?"
            />
          )}
          {quotation.status === 'converted' && quotation.convertedToOrderId && (
            <a
              href={`/orders/${quotation.convertedToOrderId}`}
              className="text-sm underline-offset-2 hover:underline"
            >
              View order →
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
                      <p>
                        {it.measurementSnapshot
                          ? `${it.measurementSnapshot.quantity} ${it.measurementSnapshot.unit}`
                          : it.qty}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Unit price</span>
                      <p>
                        {formatMoney(it.measurementSnapshot?.unitPrice ?? it.unitPrice, currency)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Tax %</span>
                      <p>{Number(it.taxRatePct).toFixed(2)}%</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Line total</span>
                      <p className="font-medium">{formatMoney(it.lineTotal, currency)}</p>
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
                                  {formatMoney(bom.unitCostAtTime, currency)}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {formatMoney(lineCost, currency)}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                      <div className="mt-1 flex justify-between text-xs">
                        <span className="text-muted-foreground">Cost basis</span>
                        <span className="tabular-nums">
                          {formatMoney(
                            it.boms.reduce(
                              (s, b) => s + Number(b.qty) * Number(b.unitCostAtTime),
                              0
                            ),
                            currency
                          )}
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
                  {it.pricingBasis === 'estimated' && it.estimatedUnitCost !== null && (
                    <div className="mt-3 grid gap-2 rounded-lg bg-muted/40 p-3 text-xs sm:grid-cols-4">
                      <div>
                        <span className="text-muted-foreground">Catalog cost</span>
                        <p className="font-medium">
                          {formatMoney(
                            Number(it.estimatedMaterialCost ?? 0) +
                              Number(it.estimatedComponentCost ?? 0),
                            currency
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Extra cost</span>
                        <p className="font-medium">
                          {formatMoney(it.estimatedExtraCost ?? 0, currency)}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Estimated unit cost</span>
                        <p className="font-medium">{formatMoney(it.estimatedUnitCost, currency)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Applied target</span>
                        <p className="font-medium">
                          {formatMoney(it.estimatedSuggestedUnitPrice ?? 0, currency)} excluding tax
                          {it.estimatedProfitPct !== null
                            ? ` · ${Number(it.estimatedProfitPct).toFixed(2)}% markup`
                            : ''}
                        </p>
                      </div>
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
            <dd className="text-right">{formatMoney(quotation.subtotal, currency)}</dd>
            <dt className="text-muted-foreground">Tax</dt>
            <dd className="text-right">{formatMoney(quotation.taxTotal, currency)}</dd>
            <dt className="font-medium">Total</dt>
            <dd className="text-right font-medium">{formatMoney(quotation.total, currency)}</dd>
          </dl>
          {quotation.note && <p className="mt-3 text-sm text-muted-foreground">{quotation.note}</p>}
        </CardContent>
      </Card>
    </div>
  )
}

QuotationShow.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
