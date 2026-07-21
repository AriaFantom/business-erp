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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/status-badge'
import DashboardLayout from '@/layouts/dashboard-layout'

type Purchase = {
  id: number
  number: string
  status: string
  supplier: { id: number; name: string } | null
  purchasedAt: string | null
  subtotal: string
  taxTotal: string
  total: string
  paidTotal: string
  returnsTotal: string
  balanceDue: string
  note: string | null
  confirmedAt: string | null
  cancelledAt: string | null
}

type Payment = {
  id: number
  amount: string
  method: string
  paidAt: string | null
  reference: string | null
  note: string | null
}

type Item = {
  id: number
  itemKind: string
  itemId: number
  itemName: string
  itemSku: string
  qty: string
  unitCost: string
  taxRatePct: string
  lineSubtotal: string
  lineTax: string
  lineTotal: string
  returnedQty: number
  machines?: { id: number; name: string }[]
}

type PurchaseReturn = {
  id: number
  number: string
  createdAt: string | null
  total: string
  note: string | null
}

type PageProps = {
  purchase: Purchase
  items: Item[]
  returns: PurchaseReturn[]
  payments: Payment[]
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

function ReturnItemsDialog({ purchaseId, items }: { purchaseId: number; items: Item[] }) {
  const [open, setOpen] = useState(false)
  const returnable = items.filter(
    (it) =>
      (it.itemKind === 'material' || it.itemKind === 'component') &&
      Number(it.qty) - it.returnedQty > 0.0005
  )
  const { data, setData, post, processing, transform, reset } = useForm<{
    qtyByItem: Record<number, string>
    note: string
  }>({ qtyByItem: {}, note: '' })

  transform((d) => ({
    items: Object.entries(d.qtyByItem)
      .map(([id, qty]) => ({ purchaseItemId: Number(id), qty: Number(qty) }))
      .filter((l) => l.qty > 0),
    note: d.note.trim() || undefined,
  }))

  const anyQty = Object.values(data.qtyByItem).some((v) => Number(v) > 0)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={returnable.length === 0}>
          Return items
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Return items to supplier</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            post(`/purchases/${purchaseId}/returns`, {
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
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Purchased</TableHead>
                <TableHead className="text-right">Returned</TableHead>
                <TableHead className="text-right">Return qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returnable.map((it) => {
                const remaining = Number(it.qty) - it.returnedQty
                return (
                  <TableRow key={it.id}>
                    <TableCell>
                      <div className="font-medium">{it.itemName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{it.itemSku}</div>
                    </TableCell>
                    <TableCell className="text-right">{it.qty}</TableCell>
                    <TableCell className="text-right">{it.returnedQty}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        max={remaining}
                        step="0.001"
                        className="ml-auto w-28 text-right"
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
          <div className="flex flex-col gap-1">
            <Label>Note</Label>
            <Input
              value={data.note}
              placeholder="Reason / reference (optional)"
              onChange={(e) => setData('note', e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={processing || !anyQty}>
              {processing ? 'Saving…' : 'Record return'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RecordPaymentDialog({ purchase }: { purchase: Purchase }) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, reset } = useForm({
    amount: purchase.balanceDue,
    method: 'bank',
    reference: '',
    note: '',
  })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Record payment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record supplier payment</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            post(`/purchases/${purchase.id}/payments`, {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setOpen(false)
              },
            })
          }}
        >
          <div className="flex flex-col gap-1">
            <Label>Amount (balance due: {purchase.balanceDue})</Label>
            <Input
              type="number"
              min={0.01}
              max={Number(purchase.balanceDue)}
              step="0.01"
              placeholder="Amount paid to the supplier"
              value={data.amount}
              onChange={(e) => setData('amount', e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Method</Label>
            <select
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
              value={data.method}
              onChange={(e) => setData('method', e.target.value)}
            >
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Reference</Label>
            <Input
              value={data.reference}
              placeholder="UTR / cheque no. (optional)"
              onChange={(e) => setData('reference', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Note</Label>
            <Input
              value={data.note}
              placeholder="Optional"
              onChange={(e) => setData('note', e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={processing || Number(data.amount) <= 0}>
              {processing ? 'Saving…' : 'Record payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function PurchaseShow({ purchase, items, returns, payments }: PageProps) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Purchase {purchase.number}</h1>
          <p className="text-sm text-muted-foreground">
            {purchase.supplier?.name ?? '—'} · {purchase.purchasedAt?.slice(0, 10) ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge kind="purchase" status={purchase.status} />
          {purchase.status === 'confirmed' && (
            <>
              <ReturnItemsDialog purchaseId={purchase.id} items={items} />
              {Number(purchase.balanceDue) > 0.005 && <RecordPaymentDialog purchase={purchase} />}
            </>
          )}
          {purchase.status === 'draft' && (
            <>
              <PostAction
                path={`/purchases/${purchase.id}/confirm`}
                label="Confirm"
                confirmText="Confirm purchase? This writes stock movements and cannot be undone."
              />
              <PostAction
                path={`/purchases/${purchase.id}/cancel`}
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
                  <TableHead>Kind</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Returned</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  <TableHead className="text-right">Tax %</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.itemKind}</TableCell>
                    <TableCell>
                      <div className="font-medium">{it.itemName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{it.itemSku}</div>
                      {it.itemKind === 'machine' && it.machines?.length ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Machines created:{' '}
                          {it.machines.map((m, i) => (
                            <span key={m.id}>
                              {i > 0 ? ', ' : ''}
                              <Link href={`/machines/${m.id}`} className="hover:underline">
                                {m.name}
                              </Link>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">{it.qty}</TableCell>
                    <TableCell className="text-right">
                      {it.returnedQty > 0 ? it.returnedQty : '—'}
                    </TableCell>
                    <TableCell className="text-right">{it.unitCost}</TableCell>
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
            <dd className="text-right">{purchase.subtotal}</dd>
            <dt className="text-muted-foreground">Tax</dt>
            <dd className="text-right">{purchase.taxTotal}</dd>
            <dt className="font-medium">Total</dt>
            <dd className="text-right font-medium">{purchase.total}</dd>
            {purchase.status === 'confirmed' && (
              <>
                {Number(purchase.returnsTotal) > 0 && (
                  <>
                    <dt className="text-muted-foreground">Returned (credit)</dt>
                    <dd className="text-right">-{purchase.returnsTotal}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Paid</dt>
                <dd className="text-right">-{purchase.paidTotal}</dd>
                <dt className="font-medium">Balance due</dt>
                <dd className="text-right font-medium">{purchase.balanceDue}</dd>
              </>
            )}
          </dl>
          {purchase.note && <p className="mt-3 text-sm text-muted-foreground">{purchase.note}</p>}
        </CardContent>
      </Card>

      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.paidAt?.slice(0, 10) ?? '—'}</TableCell>
                    <TableCell className="capitalize">{p.method}</TableCell>
                    <TableCell className="text-right">{p.amount}</TableCell>
                    <TableCell className="text-muted-foreground">{p.reference ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{p.note ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {returns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Returns</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.number}</TableCell>
                    <TableCell>{r.createdAt?.slice(0, 10) ?? '—'}</TableCell>
                    <TableCell className="text-right">{r.total}</TableCell>
                    <TableCell className="text-muted-foreground">{r.note ?? '—'}</TableCell>
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

PurchaseShow.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
