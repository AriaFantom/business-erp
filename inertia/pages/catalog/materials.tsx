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
  type: string
  defaultUnitCost: string
  reorderThresholdG: string | null
  defaultSupplier: { id: number; name: string } | null
  isActive: boolean
}

type SupplierOpt = { id: number; name: string }

type PageProps = { materials: Row[]; suppliers: SupplierOpt[] }

function NewMaterialDialog({ suppliers }: { suppliers: SupplierOpt[] }) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset, transform } = useForm({
    sku: '',
    name: '',
    type: 'filament',
    defaultSupplierId: '' as string,
    defaultUnitCost: 0,
    reorderThresholdG: '' as string,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New material</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create material</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            transform((d) => ({
              sku: d.sku,
              name: d.name,
              type: d.type,
              defaultSupplierId: d.defaultSupplierId
                ? Number(d.defaultSupplierId)
                : undefined,
              defaultUnitCost: d.defaultUnitCost,
              reorderThresholdG: d.reorderThresholdG
                ? Number(d.reorderThresholdG)
                : undefined,
            }))
            post('/catalog/materials', {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setOpen(false)
              },
            })
          }}
        >
          <Row label="SKU" error={errors.sku}>
            <Input value={data.sku} onChange={(e) => setData('sku', e.target.value)} />
          </Row>
          <Row label="Name" error={errors.name}>
            <Input value={data.name} onChange={(e) => setData('name', e.target.value)} />
          </Row>
          <Row label="Type" error={errors.type}>
            <Select value={data.type} onValueChange={(v) => setData('type', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="filament">Filament</SelectItem>
                <SelectItem value="resin">Resin</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Default supplier" error={errors.defaultSupplierId}>
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
          </Row>
          <Row label="Default unit cost (per g)" error={errors.defaultUnitCost}>
            <Input
              type="number"
              step="0.0001"
              value={data.defaultUnitCost}
              onChange={(e) => setData('defaultUnitCost', Number(e.target.value))}
            />
          </Row>
          <Row label="Reorder threshold (g)" error={errors.reorderThresholdG}>
            <Input
              type="number"
              step="0.001"
              value={data.reorderThresholdG}
              onChange={(e) => setData('reorderThresholdG', e.target.value)}
            />
          </Row>
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

function Row({
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

export default function MaterialsPage({ materials, suppliers }: PageProps) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Materials</h1>
          <p className="text-sm text-muted-foreground">
            {materials.length} materials in catalog.
          </p>
        </div>
        <NewMaterialDialog suppliers={suppliers} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All materials</CardTitle>
        </CardHeader>
        <CardContent>
          {materials.length === 0 ? (
            <p className="text-sm text-muted-foreground">No materials yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Default unit cost</TableHead>
                  <TableHead>Reorder at</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.sku}</TableCell>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>{m.type}</TableCell>
                    <TableCell>{m.defaultUnitCost}</TableCell>
                    <TableCell>{m.reorderThresholdG ?? '—'} g</TableCell>
                    <TableCell>{m.defaultSupplier?.name ?? '—'}</TableCell>
                    <TableCell>
                      {m.isActive ? (
                        <Badge variant="outline">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Archived</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {m.isActive && (
                        <ArchiveAction
                          path={`/catalog/materials/${m.id}/archive`}
                          name={m.name}
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

MaterialsPage.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
