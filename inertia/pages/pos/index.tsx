import { type ReactElement, useMemo, useState } from 'react'
import { router, useForm } from '@inertiajs/react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import DashboardLayout from '@/layouts/dashboard-layout'
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

type PageProps = {
  products: Product[]
  categories: Category[]
  customers: Customer[]
  filters: Filters
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

function priceFromProfit(cost: number, profitPct: number): number {
  return round2(cost * (1 + profitPct / 100))
}

export default function PosPage({ products, categories, customers, filters }: PageProps) {
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerId, setCustomerId] = useState<string>(
    customers[0] ? String(customers[0].id) : ''
  )
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [paymentReference, setPaymentReference] = useState<string>('')

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

  function changeProfit(productId: number, profitPct: number) {
    const line = cart.find((l) => l.productId === productId)
    if (!line) return
    patchLine(productId, {
      profitPct,
      unitPrice: priceFromProfit(line.unitCost, profitPct),
    })
  }

  function changePrice(productId: number, unitPrice: number) {
    patchLine(productId, { unitPrice: Math.max(0, unitPrice) })
  }

  function changeTax(productId: number, taxRatePct: number) {
    patchLine(productId, { taxRatePct: Math.max(0, taxRatePct) })
  }

  function removeLine(productId: number) {
    setCart((prev) => prev.filter((l) => l.productId !== productId))
  }

  function clearCart() {
    setCart([])
  }

  function checkout(e: React.FormEvent) {
    e.preventDefault()
    if (!customerId) return
    if (cart.length === 0) return
    transform(() => ({
      customerId: Number(customerId),
      paymentMethod,
      paymentReference: paymentReference || undefined,
      items: cart.map((l) => ({
        productId: l.productId,
        qty: l.qty,
        unitPrice: l.unitPrice,
        taxRatePct: l.taxRatePct,
      })),
    }))
    post('/pos/sell', {
      preserveScroll: true,
      onSuccess: () => {
        clearCart()
      },
    })
  }

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Point of sale</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Products in stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{products.length}</p>
            <p className="text-xs text-muted-foreground">
              {products.reduce((s, p) => s + p.stockQty, 0)} units available.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cart lines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{cart.length}</p>
            <p className="text-xs text-muted-foreground">
              {cart.reduce((s, l) => s + l.qty, 0)} units staged.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cart total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">₹{totals.total.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">
              ₹{totals.subtotal.toFixed(2)} + tax ₹{totals.tax.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_440px]">
        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No products are in stock — complete a production job to add
                inventory.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {products.map((p) => {
                  const inCart =
                    cart.find((l) => l.productId === p.id)?.qty ?? 0
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
                          <span className="line-clamp-2 text-sm font-medium">
                            {p.name}
                          </span>
                          <Badge
                            variant={disabled ? 'destructive' : 'secondary'}
                            className="shrink-0 text-[10px]"
                          >
                            {remaining} left
                          </Badge>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {p.sku}
                        </span>
                        {p.category && (
                          <Badge variant="outline" className="w-fit text-[10px]">
                            {p.category.name}
                          </Badge>
                        )}
                        <div className="mt-1 flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">
                            Cost ₹{p.unitCost.toFixed(2)}
                          </span>
                          <span className="font-semibold">
                            ₹{p.suggestedUnitPrice.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {p.profitPct.toFixed(1)}% profit · {p.taxRatePct.toFixed(1)}% tax
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cart</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3" onSubmit={checkout}>
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
                {(errors as Record<string, string>).customerId && (
                  <span className="text-xs text-destructive">
                    {(errors as Record<string, string>).customerId}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label>Items</Label>
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Tap a product to add it.
                  </p>
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
                              <span className="line-clamp-1 text-sm font-medium">
                                {l.name}
                              </span>
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
                          <div className="grid grid-cols-4 gap-1">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-muted-foreground">
                                Qty
                              </span>
                              <Input
                                type="number"
                                step="1"
                                min="1"
                                max={l.stockQty}
                                value={l.qty}
                                onChange={(e) =>
                                  changeQty(l.productId, Number(e.target.value))
                                }
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-muted-foreground">
                                Profit %
                              </span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={l.profitPct}
                                onChange={(e) =>
                                  changeProfit(l.productId, Number(e.target.value))
                                }
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-muted-foreground">
                                Unit price
                              </span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={l.unitPrice}
                                onChange={(e) =>
                                  changePrice(l.productId, Number(e.target.value))
                                }
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-muted-foreground">
                                Tax %
                              </span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={l.taxRatePct}
                                onChange={(e) =>
                                  changeTax(l.productId, Number(e.target.value))
                                }
                              />
                            </div>
                          </div>
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>
                              ₹{lineSubtotal.toFixed(2)} + tax ₹{lineTax.toFixed(2)}
                            </span>
                            <span className="font-semibold text-foreground">
                              ₹{lineTotal.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label>Payment method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
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
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>₹{totals.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={clearCart}
                  disabled={cart.length === 0}
                >
                  Clear
                </Button>
                <Button
                  type="submit"
                  variant="success"
                  className="flex-1"
                  disabled={
                    processing || cart.length === 0 || !customerId || totals.total <= 0
                  }
                >
                  {processing ? 'Processing…' : `Pay ₹${totals.total.toFixed(2)}`}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

PosPage.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>

void router
