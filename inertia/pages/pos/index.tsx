import { type ReactElement, useEffect, useMemo, useState } from 'react'
import { router, useForm, usePage } from '@inertiajs/react'
import { Trash2 } from 'lucide-react'
import { hasPermission } from '@/lib/nav'
import type { InertiaProps } from '@/types'
import { Button } from '@/components/ui/button'
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import PosLayout from '@/layouts/pos-layout'
import { ListToolbar } from '@/components/catalog/list-toolbar'

type Product = {
  id: number
  sku: string
  name: string
  category: { id: number; name: string } | null
  imageUrl: string | null
  unitCost: number
  profitPct: number
  taxRatePct: number
  suggestedUnitPrice: number
  stockQty: number
}

type Category = {
  id: number
  name: string
  defaultProfitPct: string | null
  taxRatePct: string | null
}

type Customer = { id: number; name: string }

type Filters = { q: string; categoryId: string }

type CashSessionSummary = {
  byMethod: Record<string, string>
  salesCount: number
  expectedCash: number
}

type CashSession = {
  id: number
  number: string
  openedAt: string | null
  openingFloat: number
  summary: CashSessionSummary
}

type PageProps = {
  products: Product[]
  categories: Category[]
  customers: Customer[]
  filters: Filters
  cashSession: CashSession | null
  canManageSession: boolean
}

type CartLine = {
  productId: number
  sku: string
  name: string
  qty: number
  unitCost: number
  profitPct: number
  taxRatePct: number
  unitPrice: number
  stockQty: number
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export default function PosPage({
  products,
  categories,
  customers,
  filters,
  cashSession,
  canManageSession,
}: PageProps) {
  const { user } = usePage<InertiaProps<PageProps>>().props
  const canOverridePrice = hasPermission(user, 'orders.overridePrice')
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerId, setCustomerId] = useState<string>(
    customers[0] ? String(customers[0].id) : ''
  )
  const [paymentMethod, setPaymentMethod] = useState<string>(cashSession ? 'cash' : 'bank')
  const [paymentReference, setPaymentReference] = useState<string>('')

  // If the register gets closed (or the page loads closed) while "cash" is
  // still selected, fall back to a method that doesn't need a session.
  useEffect(() => {
    if (!cashSession && paymentMethod === 'cash') {
      setPaymentMethod('bank')
    }
  }, [cashSession, paymentMethod])

  const { processing, errors, post, transform } = useForm({})

  const totals = useMemo(() => {
    let subtotal = 0
    let tax = 0
    for (const l of cart) {
      const ls = round2(l.qty * l.unitPrice)
      const lt = round2((ls * l.taxRatePct) / 100)
      subtotal += ls
      tax += lt
    }
    return {
      subtotal: round2(subtotal),
      tax: round2(tax),
      total: round2(subtotal + tax),
    }
  }, [cart])

  function addToCart(p: Product) {
    if (p.stockQty <= 0) return
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id)
      if (existing) {
        const nextQty = Math.min(existing.qty + 1, p.stockQty)
        return prev.map((l) =>
          l.productId === p.id ? { ...l, qty: nextQty } : l
        )
      }
      return [
        ...prev,
        {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          qty: 1,
          unitCost: p.unitCost,
          profitPct: p.profitPct,
          taxRatePct: p.taxRatePct,
          unitPrice: p.suggestedUnitPrice,
          stockQty: p.stockQty,
        },
      ]
    })
  }

  function patchLine(productId: number, patch: Partial<CartLine>) {
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l))
    )
  }

  function changeQty(productId: number, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((l) => l.productId !== productId))
      return
    }
    const line = cart.find((l) => l.productId === productId)
    const clamped = line ? Math.min(qty, line.stockQty) : qty
    patchLine(productId, { qty: clamped })
  }

  function changePrice(productId: number, unitPrice: number) {
    if (!canOverridePrice) return
    patchLine(productId, { unitPrice: Math.max(0, unitPrice) })
  }

  function removeLine(productId: number) {
    setCart((prev) => prev.filter((l) => l.productId !== productId))
  }

  function clearCart() {
    setCart([])
  }

  // Fresh key whenever the cart contents change; a double-click/retry of the
  // same cart reuses the key so the server can replay the original sale.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), [cart])

  function checkout(e: React.FormEvent) {
    e.preventDefault()
    if (!customerId) return
    if (cart.length === 0) return
    if (paymentMethod === 'cash' && !cashSession) return
    transform(() => ({
      customerId: Number(customerId),
      paymentMethod,
      paymentReference: paymentReference || undefined,
      idempotencyKey,
      items: cart.map((l) => ({
        productId: l.productId,
        qty: l.qty,
        unitPrice: l.unitPrice,
      })),
    }))
    post('/pos/sell', {
      preserveScroll: true,
      onSuccess: () => {
        clearCart()
      },
    })
  }

  const customerError = (errors as Record<string, string>).customerId

  return (
    <div className="flex h-full flex-col">
      <CashSessionStrip cashSession={cashSession} canManageSession={canManageSession} />
      <form onSubmit={checkout} className="flex flex-1 overflow-hidden">
        {/* Left — product catalogue */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b p-3">
            <ListToolbar
            basePath="/pos"
            q={filters.q}
            searchPlaceholder="Search by name or SKU…"
            selects={[
              {
                name: 'categoryId',
                value: filters.categoryId,
                options: [
                  { value: 'all', label: 'All categories' },
                  ...categories.map((c) => ({ value: String(c.id), label: c.name })),
                ],
              },
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No products are in stock — complete a production job to add inventory.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {products.map((p) => {
                const inCart = cart.find((l) => l.productId === p.id)?.qty ?? 0
                const remaining = p.stockQty - inCart
                const disabled = remaining <= 0
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    disabled={disabled}
                    className="group flex flex-col items-stretch gap-2 rounded border border-border bg-card p-3 text-left transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border"
                  >
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="h-24 w-full rounded object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-24 w-full items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                        No image
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-1">
                        <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                        <Badge
                          variant={disabled ? 'destructive' : 'secondary'}
                          className="shrink-0 text-[10px]"
                        >
                          {remaining} left
                        </Badge>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">{p.sku}</span>
                      {p.category && (
                        <Badge variant="outline" className="w-fit text-[10px]">
                          {p.category.name}
                        </Badge>
                      )}
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          Cost ₹{p.unitCost.toFixed(2)}
                        </span>
                        <span className="font-semibold">₹{p.suggestedUnitPrice.toFixed(2)}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {p.taxRatePct.toFixed(1)}% tax
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right — cart / checkout */}
      <aside className="flex w-[420px] shrink-0 flex-col overflow-hidden border-l bg-card">
        <div className="shrink-0 border-b p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Cart</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearCart}
              disabled={cart.length === 0}
            >
              Clear
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
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
            {customerError && <span className="text-xs text-destructive">{customerError}</span>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tap a product to add it.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {cart.map((l) => {
                const lineSubtotal = round2(l.qty * l.unitPrice)
                const lineTax = round2((lineSubtotal * l.taxRatePct) / 100)
                const lineTotal = round2(lineSubtotal + lineTax)
                return (
                  <div
                    key={l.productId}
                    className="flex flex-col gap-2 rounded border border-border p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="line-clamp-1 text-sm font-medium">{l.name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          cost ₹{l.unitCost.toFixed(2)} · stock {l.stockQty}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove line"
                        onClick={() => removeLine(l.productId)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground">Qty</span>
                        <Input
                          type="number"
                          step="1"
                          min="1"
                          max={l.stockQty}
                          value={l.qty}
                          onChange={(e) => changeQty(l.productId, Number(e.target.value))}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground">Unit price</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={l.unitPrice}
                          disabled={!canOverridePrice}
                          title={
                            canOverridePrice
                              ? undefined
                              : 'You need the price-override permission to edit line prices.'
                          }
                          onChange={(e) => changePrice(l.productId, Number(e.target.value))}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground">Tax %</span>
                        <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                          {l.taxRatePct.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>
                        ₹{lineSubtotal.toFixed(2)} + tax ₹{lineTax.toFixed(2)}
                      </span>
                      <span className="font-semibold text-foreground">₹{lineTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label>Payment method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash" disabled={!cashSession}>
                    Cash
                  </SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {!cashSession && (
                <span className="text-[10px] text-muted-foreground">
                  Open a cash session to accept cash payments.
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Label>Reference</Label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1 rounded bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>₹{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span>₹{totals.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>₹{totals.total.toFixed(2)}</span>
            </div>
          </div>

          <Button
            type="submit"
            variant="success"
            className="h-12 text-base"
            disabled={
              processing ||
              cart.length === 0 ||
              !customerId ||
              totals.total <= 0 ||
              (paymentMethod === 'cash' && !cashSession)
            }
          >
            {processing ? 'Processing…' : `Pay ₹${totals.total.toFixed(2)}`}
          </Button>
        </div>
      </aside>
      </form>
    </div>
  )
}

function CashSessionStrip({
  cashSession,
  canManageSession,
}: {
  cashSession: CashSession | null
  canManageSession: boolean
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-2 text-sm">
      {cashSession ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-medium">Session {cashSession.number}</span>
            <span className="text-muted-foreground">
              Opened{' '}
              {cashSession.openedAt
                ? new Date(cashSession.openedAt).toLocaleTimeString()
                : '—'}
            </span>
            <span className="text-muted-foreground">
              Expected cash ₹{cashSession.summary.expectedCash.toFixed(2)}
            </span>
          </div>
          {canManageSession && <CloseSessionDialog cashSession={cashSession} />}
        </>
      ) : (
        <>
          <span className="text-muted-foreground">
            No cash session — cash payments are disabled.
          </span>
          {canManageSession && <OpenSessionDialog />}
        </>
      )}
    </div>
  )
}

function OpenSessionDialog() {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset } = useForm({
    openingFloat: 0,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          Open session
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open cash session</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            post('/pos/session/open', {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setOpen(false)
              },
            })
          }}
        >
          <div className="flex flex-col gap-1">
            <Label>Opening float</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={data.openingFloat}
              onChange={(e) => setData('openingFloat', Number(e.target.value))}
            />
            {errors.openingFloat && (
              <span className="text-xs text-destructive">{errors.openingFloat}</span>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={processing}>
              {processing ? 'Opening…' : 'Open session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CloseSessionDialog({ cashSession }: { cashSession: CashSession }) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset } = useForm({
    countedCash: cashSession.summary.expectedCash,
    note: '',
  })

  const variance = round2(Number(data.countedCash || 0) - cashSession.summary.expectedCash)
  const cashSales = Number(cashSession.summary.byMethod.cash ?? '0')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Close session (Z-report)
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close cash session {cashSession.number}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            post('/pos/session/close', {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setOpen(false)
              },
            })
          }}
        >
          <div className="grid grid-cols-2 gap-y-1 rounded bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">Opening float</span>
            <span className="text-right">₹{cashSession.openingFloat.toFixed(2)}</span>
            <span className="text-muted-foreground">Cash sales</span>
            <span className="text-right">₹{cashSales.toFixed(2)}</span>
            <span className="text-muted-foreground">Sales count</span>
            <span className="text-right">{cashSession.summary.salesCount}</span>
            <span className="font-medium">Expected cash</span>
            <span className="text-right font-medium">
              ₹{cashSession.summary.expectedCash.toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Counted cash</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={data.countedCash}
              onChange={(e) => setData('countedCash', Number(e.target.value))}
            />
            {errors.countedCash && (
              <span className="text-xs text-destructive">{errors.countedCash}</span>
            )}
          </div>
          <div
            className={
              'rounded p-2 text-sm font-medium ' +
              (variance === 0
                ? 'bg-muted/40 text-muted-foreground'
                : variance > 0
                  ? 'bg-success/10 text-success'
                  : 'bg-destructive/10 text-destructive')
            }
          >
            Variance: {variance > 0 ? '+' : ''}
            ₹{variance.toFixed(2)}
          </div>
          <div className="flex flex-col gap-1">
            <Label>Note</Label>
            <Textarea
              value={data.note}
              onChange={(e) => setData('note', e.target.value)}
              placeholder="Optional"
            />
            {errors.note && <span className="text-xs text-destructive">{errors.note}</span>}
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={processing}>
              {processing ? 'Closing…' : 'Close session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

PosPage.layout = (page: ReactElement) => <PosLayout>{page}</PosLayout>

void router
