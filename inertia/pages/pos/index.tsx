import { type ReactElement, useMemo, useState } from 'react'
import { router, useForm } from '@inertiajs/react'
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
  defaultProfitPct: string | null
  taxRatePct: string | null
  imageUrl: string | null
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
  unitPrice: number
  taxRatePct: number
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function defaultPrice(_p: Product): number {
  return 0
}

function defaultTax(p: Product): number {
  return p.taxRatePct ? Number(p.taxRatePct) : 0
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
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id)
      if (existing) {
        return prev.map((l) =>
          l.productId === p.id ? { ...l, qty: l.qty + 1 } : l
        )
      }
      return [
        ...prev,
        {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          qty: 1,
          unitPrice: defaultPrice(p),
          taxRatePct: defaultTax(p),
        },
      ]
    })
  }

  function changeQty(productId: number, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((l) => l.productId !== productId))
      return
    }
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, qty } : l))
    )
  }

  function changePrice(productId: number, price: number) {
    setCart((prev) =>
      prev.map((l) =>
        l.productId === productId ? { ...l, unitPrice: Math.max(0, price) } : l
      )
    )
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
          <p className="text-sm text-muted-foreground">
            Sell products directly. Each sale auto-issues a paid invoice.
          </p>
        </div>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No products match the filters.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    className="group flex flex-col items-stretch gap-2 rounded border border-border bg-card p-3 text-left transition hover:border-primary"
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
                      <span className="line-clamp-2 text-sm font-medium">
                        {p.name}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {p.sku}
                      </span>
                      {p.category && (
                        <Badge variant="outline" className="w-fit text-[10px]">
                          {p.category.name}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
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
                    {cart.map((l) => (
                      <div
                        key={l.productId}
                        className="flex flex-col gap-1 rounded border border-border p-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="line-clamp-1 text-sm font-medium">
                            {l.name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLine(l.productId)}
                          >
                            ×
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-muted-foreground">
                              Qty
                            </span>
                            <Input
                              type="number"
                              step="1"
                              min="1"
                              value={l.qty}
                              onChange={(e) =>
                                changeQty(l.productId, Number(e.target.value))
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
                                setCart((prev) =>
                                  prev.map((x) =>
                                    x.productId === l.productId
                                      ? { ...x, taxRatePct: Number(e.target.value) }
                                      : x
                                  )
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
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

// Keep imports tree-shake-stable
void router
