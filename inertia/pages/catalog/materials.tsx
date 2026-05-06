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
import { ImageUploader } from '@/components/catalog/image-uploader'
import { ListToolbar } from '@/components/catalog/list-toolbar'

type Row = {
  id: number
  sku: string
  name: string
  type: string
  defaultUnitCost: string
  reorderThresholdG: string | null
  defaultSupplier: { id: number; name: string } | null
  imageUrl: string | null
  isActive: boolean
}

type SupplierOpt = { id: number; name: string }

type Filters = { q: string; status: string; type: string }

type PageProps = { materials: Row[]; suppliers: SupplierOpt[]; filters: Filters }

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
      <DialogContent className="sm:max-w-lg">
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
          <Field label="SKU" error={errors.sku}>
            <Input value={data.sku} onChange={(e) => setData('sku', e.target.value)} />
          </Field>
          <Field label="Name" error={errors.name}>
            <Input value={data.name} onChange={(e) => setData('name', e.target.value)} />
          </Field>
          <Field label="Type" error={errors.type}>
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
          <Field label="Default unit cost (per g)" error={errors.defaultUnitCost}>
            <Input
              type="number"
              step="0.0001"
              value={data.defaultUnitCost}
              onChange={(e) => setData('defaultUnitCost', Number(e.target.value))}
            />
          </Field>
          <Field label="Reorder threshold (g)" error={errors.reorderThresholdG}>
            <Input
              type="number"
              step="0.001"
              value={data.reorderThresholdG}
              onChange={(e) => setData('reorderThresholdG', e.target.value)}
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

function Thumb({ url, alt }: { url: string | null; alt: string }) {
  if (!url)
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
        —
      </div>
    )
  return (
    <img
      src={url}
      alt={alt}
      className="h-10 w-10 rounded object-cover"
      loading="lazy"
    />
  )
}

export default function MaterialsPage({ materials, suppliers, filters }: PageProps) {
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Materials</h1>
          <p className="text-sm text-muted-foreground">
            {materials.length} materials in catalog.
          </p>
        </div>
        <NewMaterialDialog suppliers={suppliers} />
      </div>

      <ListToolbar
        basePath="/catalog/materials"
        q={filters.q}
        searchPlaceholder="Search by name or SKU…"
        selects={[
          {
            name: 'type',
            value: filters.type,
            options: [
              { value: 'all', label: 'All types' },
              { value: 'filament', label: 'Filament' },
              { value: 'resin', label: 'Resin' },
              { value: 'other', label: 'Other' },
            ],
          },
          {
            name: 'status',
            value: filters.status,
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived' },
            ],
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>All materials</CardTitle>
        </CardHeader>
        <CardContent>
          {materials.length === 0 ? (
            <p className="text-sm text-muted-foreground">No materials match the filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Image</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Default unit cost</TableHead>
                  <TableHead>Reorder at</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-56 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Thumb url={m.imageUrl} alt={m.name} />
                    </TableCell>
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
                      <div className="flex justify-end gap-2">
                        <ImageUploader
                          uploadPath={`/catalog/materials/${m.id}/image`}
                          deletePath={`/catalog/materials/${m.id}/image/delete`}
                          hasImage={!!m.imageUrl}
                        />
                        {m.isActive && (
                          <ArchiveAction
                            path={`/catalog/materials/${m.id}/archive`}
                            name={m.name}
                          />
                        )}
                      </div>
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
