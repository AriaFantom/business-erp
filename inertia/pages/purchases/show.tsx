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
  note: string | null
  confirmedAt: string | null
  cancelledAt: string | null
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
  machines?: { id: number; name: string }[]
}

type PageProps = { purchase: Purchase; items: Item[] }

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

export default function PurchaseShow({ purchase, items }: PageProps) {
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
          </dl>
          {purchase.note && <p className="mt-3 text-sm text-muted-foreground">{purchase.note}</p>}
        </CardContent>
      </Card>
    </div>
  )
}

PurchaseShow.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
