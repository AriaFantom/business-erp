import { type ReactElement, useState } from 'react'
import { Link, useForm } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
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
import { Badge } from '@/components/ui/badge'
import DashboardLayout from '@/layouts/dashboard-layout'

type PurchaseRow = {
  id: number
  number: string
  supplierId: number
  supplierName: string
  status: string
  purchasedAt: string | null
  total: string
  confirmedAt: string | null
}

type SupplierOpt = { id: number; name: string }
type ItemOpt = {
  id: number
  sku: string
  name: string
  unit: string
  defaultUnitCost: string
}

type PageProps = {
  purchases: PurchaseRow[]
  suppliers: SupplierOpt[]
  materials: ItemOpt[]
  components: ItemOpt[]
}

type LineDraft = {
  itemKind: 'material' | 'component'
  itemId: number
  qty: number
  unitCost: number
  taxRatePct: number
}

function statusVariant(s: string) {
  if (s === 'confirmed') return 'default' as const
  if (s === 'cancelled') return 'secondary' as const
  return 'outline' as const
}

function NewPurchaseDialog({
  suppliers,
  materials,
  components,
}: {
  suppliers: SupplierOpt[]
  materials: ItemOpt[]
  components: ItemOpt[]
}) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset } = useForm({
    supplierId: '',
    purchasedAt: new Date().toISOString().slice(0, 10),
    note: '',
    items: [] as LineDraft[],
  })

  const addLine = (kind: 'material' | 'component', itemId: number) => {
    const pool = kind === 'material' ? materials : components
    const it = pool.find((p) => p.id === itemId)
    if (!it) return
    setData('items', [
      ...data.items,
      {
        itemKind: kind,
        itemId,
        qty: 1,
        unitCost: Number(it.defaultUnitCost),
        taxRatePct: 18,
      },
    ])
  }

  const removeLine = (idx: number) =>
    setData('items', data.items.filter((_, i) => i !== idx))

  const updateLine = (idx: number, patch: Partial<LineDraft>) =>
    setData(
      'items',
      data.items.map((ln, i) => (i === idx ? { ...ln, ...patch } : ln))
    )

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    post('/purchases', {
      preserveScroll: true,
      onSuccess: () => {
        reset()
        setOpen(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New purchase</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create purchase</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier" error={errors.supplierId}>
              <Select
                value={data.supplierId}
                onValueChange={(v) => setData('supplierId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Purchased on" error={errors.purchasedAt}>
              <Input
                type="date"
                value={data.purchasedAt}
                onChange={(e) => setData('purchasedAt', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Note" error={errors.note}>
            <Input
              value={data.note}
              onChange={(e) => setData('note', e.target.value)}
            />
          </Field>

          <div className="rounded border p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-medium">Add line:</span>
              <Select onValueChange={(v) => addLine('material', Number(v))}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Material…" />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name} ({m.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select onValueChange={(v) => addLine('component', Number(v))}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Component…" />
                </SelectTrigger>
                <SelectContent>
                  {components.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} ({c.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lines yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit cost</TableHead>
                    <TableHead>Tax %</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((ln, i) => {
                    const pool = ln.itemKind === 'material' ? materials : components
                    const it = pool.find((p) => p.id === ln.itemId)
                    return (
                      <TableRow key={i}>
                        <TableCell className="text-sm">
                          [{ln.itemKind}] {it?.name ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.001"
                            value={ln.qty}
                            onChange={(e) =>
                              updateLine(i, { qty: Number(e.target.value) })
                            }
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.0001"
                            value={ln.unitCost}
                            onChange={(e) =>
                              updateLine(i, { unitCost: Number(e.target.value) })
                            }
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={ln.taxRatePct}
                            onChange={(e) =>
                              updateLine(i, { taxRatePct: Number(e.target.value) })
                            }
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLine(i)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={processing || !data.supplierId || data.items.length === 0}
            >
              {processing ? 'Saving…' : 'Create draft'}
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

export default function PurchasesIndex({
  purchases,
  suppliers,
  materials,
  components,
}: PageProps) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Purchases</h1>
          <p className="text-sm text-muted-foreground">{purchases.length} purchases.</p>
        </div>
        <NewPurchaseDialog
          suppliers={suppliers}
          materials={materials}
          components={components}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All purchases</CardTitle>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No purchases yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Purchased on</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.number}</TableCell>
                    <TableCell>{p.supplierName}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                    </TableCell>
                    <TableCell>{p.purchasedAt?.slice(0, 10) ?? '—'}</TableCell>
                    <TableCell className="text-right">{p.total}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/purchases/${p.id}`}
                        className="text-sm underline-offset-2 hover:underline"
                      >
                        Open
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

PurchasesIndex.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
