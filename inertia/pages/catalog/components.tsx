import { type ReactElement, useState } from 'react'
import { useForm } from '@inertiajs/react'
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

type Row = {
  id: number
  sku: string
  name: string
  defaultUnitCost: string
  reorderThresholdQty: number | null
  defaultSupplier: { id: number; name: string } | null
  isActive: boolean
}

type SupplierOpt = { id: number; name: string }

type PageProps = { components: Row[]; suppliers: SupplierOpt[] }

function NewComponentDialog({ suppliers }: { suppliers: SupplierOpt[] }) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset, transform } = useForm({
    sku: '',
    name: '',
    defaultSupplierId: '',
    defaultUnitCost: 0,
    reorderThresholdQty: '',
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New component</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create component</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            transform((d) => ({
              sku: d.sku,
              name: d.name,
              defaultSupplierId: d.defaultSupplierId
                ? Number(d.defaultSupplierId)
                : undefined,
              defaultUnitCost: d.defaultUnitCost,
              reorderThresholdQty: d.reorderThresholdQty
                ? Number(d.reorderThresholdQty)
                : undefined,
            }))
            post('/catalog/components', {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setOpen(false)
              },
            })
          }}
        >
          <Field label="SKU" error={errors.sku}>
            <Input value={data.sku} onChange={(e) => setData('sku', e.target.value)} />
          </Field>
          <Field label="Name" error={errors.name}>
            <Input value={data.name} onChange={(e) => setData('name', e.target.value)} />
          </Field>
          <Field label="Default supplier" error={errors.defaultSupplierId}>
            <Select
              value={data.defaultSupplierId}
              onValueChange={(v) => setData('defaultSupplierId', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
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
          <Field label="Default unit cost" error={errors.defaultUnitCost}>
            <Input
              type="number"
              step="0.0001"
              value={data.defaultUnitCost}
              onChange={(e) => setData('defaultUnitCost', Number(e.target.value))}
            />
          </Field>
          <Field label="Reorder threshold (pcs)" error={errors.reorderThresholdQty}>
            <Input
              type="number"
              value={data.reorderThresholdQty}
              onChange={(e) => setData('reorderThresholdQty', e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={processing}>
              {processing ? 'Saving…' : 'Create'}
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

function ArchiveAction({ path, name }: { path: string; name: string }) {
  const { post, processing } = useForm()
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={processing}
      onClick={() => {
        if (window.confirm(`Archive ${name}?`)) post(path, { preserveScroll: true })
      }}
    >
      Archive
    </Button>
  )
}

export default function ComponentsPage({ components, suppliers }: PageProps) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Components</h1>
          <p className="text-sm text-muted-foreground">{components.length} components.</p>
        </div>
        <NewComponentDialog suppliers={suppliers} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All components</CardTitle>
        </CardHeader>
        <CardContent>
          {components.length === 0 ? (
            <p className="text-sm text-muted-foreground">No components yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Default cost</TableHead>
                  <TableHead>Reorder at</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {components.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.sku}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.defaultUnitCost}</TableCell>
                    <TableCell>{c.reorderThresholdQty ?? '—'} pcs</TableCell>
                    <TableCell>{c.defaultSupplier?.name ?? '—'}</TableCell>
                    <TableCell>
                      {c.isActive ? (
                        <Badge variant="outline">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Archived</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.isActive && (
                        <ArchiveAction
                          path={`/catalog/components/${c.id}/archive`}
                          name={c.name}
                        />
                      )}
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

ComponentsPage.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
