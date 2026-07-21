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
import { ConfirmDialog } from '@/components/confirm-dialog'
import { AvatarUploader } from '@/components/catalog/avatar-uploader'
import { ListToolbar } from '@/components/catalog/list-toolbar'
import { StatCard } from '@/components/catalog/stat-card'
import { UnitPicker } from '@/components/catalog/unit-picker'
import { InlineImagePicker } from '@/components/catalog/inline-image-picker'
import { Boxes, CheckCircle2, XCircle } from 'lucide-react'
import { ColumnVisibilityMenu, type ColumnDef } from '@/components/data-table/column-visibility'
import { useColumnVisibility } from '@/hooks/use-column-visibility'
import { EmptyState } from '@/components/empty-state'
import { SkuField } from '@/components/catalog/sku-field'

type Row = {
  id: number
  sku: string
  name: string
  type: string
  unit: string
  defaultUnitCost: string
  reorderThresholdG: string | null
  defaultSupplier: { id: number; name: string } | null
  imageUrl: string | null
  isActive: boolean
}

type SupplierOpt = { id: number; name: string }

type Filters = { q: string; status: string; type: string }

type Counts = { total: number; active: number; archived: number }

type PageProps = {
  materials: Row[]
  suppliers: SupplierOpt[]
  filters: Filters
  counts: Counts
}

function NewMaterialDialog({ suppliers }: { suppliers: SupplierOpt[] }) {
  const [open, setOpen] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const { data, setData, post, processing, errors, reset, transform } = useForm({
    sku: '',
    name: '',
    type: 'filament',
    unit: 'g',
    defaultSupplierId: '' as string,
    defaultUnitCost: 0,
    reorderThresholdG: '' as string,
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) {
          setImageFile(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>New material</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create material</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            transform((d) => {
              const out: Record<string, unknown> = {
                sku: d.sku,
                name: d.name,
                type: d.type,
                unit: d.unit || 'g',
                defaultSupplierId: d.defaultSupplierId ? Number(d.defaultSupplierId) : undefined,
                defaultUnitCost: d.defaultUnitCost,
                reorderThresholdG: d.reorderThresholdG ? Number(d.reorderThresholdG) : undefined,
              }
              if (imageFile) out.image = imageFile
              return out as never
            })
            post('/catalog/materials', {
              forceFormData: !!imageFile,
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setImageFile(null)
                setOpen(false)
              },
            })
          }}
        >
          <InlineImagePicker file={imageFile} onChange={setImageFile} />
          <div className="grid grid-cols-2 gap-3">
            <SkuField
              id="material-sku"
              name={data.name}
              value={data.sku}
              onChange={(sku) => setData('sku', sku)}
              error={errors.sku}
            />
            <Field label="Name" error={errors.name}>
              <Input
                placeholder="e.g. Cotton Yarn Blue"
                value={data.name}
                onChange={(e) => setData('name', e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <Field label="Unit of measure" error={errors.unit}>
              <UnitPicker value={data.unit} onChange={(v) => setData('unit', v)} />
            </Field>
          </div>
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
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={`Default unit cost (per ${data.unit || 'unit'})`}
              error={errors.defaultUnitCost}
            >
              <Input
                type="number"
                step="0.0001"
                placeholder="Cost per unit, e.g. 12.50"
                value={data.defaultUnitCost}
                onChange={(e) => setData('defaultUnitCost', Number(e.target.value))}
              />
            </Field>
            <Field
              label={`Reorder threshold (${data.unit || 'unit'})`}
              error={errors.reorderThresholdG}
            >
              <Input
                type="number"
                step="0.001"
                placeholder="Alert when stock drops below this"
                value={data.reorderThresholdG}
                onChange={(e) => setData('reorderThresholdG', e.target.value)}
              />
            </Field>
          </div>
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
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="destructive" size="sm" disabled={processing} onClick={() => setOpen(true)}>
        Archive
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Archive ${name}?`}
        description="The material will be hidden from new purchases and jobs. You can reactivate it later."
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={() => post(path, { preserveScroll: true })}
      />
    </>
  )
}

function RestoreAction({ path, name }: { path: string; name: string }) {
  const { post, processing } = useForm()
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={processing}
      onClick={() => post(path, { preserveScroll: true })}
      title={`Restore ${name}`}
    >
      Restore
    </Button>
  )
}

const MATERIAL_COLUMNS: ColumnDef[] = [
  { key: 'image', label: 'Image' },
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Name', required: true },
  { key: 'type', label: 'Type' },
  { key: 'unit', label: 'Unit' },
  { key: 'cost', label: 'Default unit cost' },
  { key: 'reorder', label: 'Reorder at' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions', required: true },
]

export default function MaterialsPage({ materials, suppliers, filters, counts }: PageProps) {
  const { isVisible, toggle, reset } = useColumnVisibility('catalog.materials')
  const archivedHref = `/catalog/materials?status=archived${filters.type && filters.type !== 'all' ? `&type=${filters.type}` : ''}`
  const activeHref = `/catalog/materials?status=active${filters.type && filters.type !== 'all' ? `&type=${filters.type}` : ''}`
  const totalHref = `/catalog/materials${filters.type && filters.type !== 'all' ? `?type=${filters.type}` : ''}`
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Materials</h1>
          <p className="text-sm text-muted-foreground">{materials.length} materials in catalog.</p>
        </div>
        <NewMaterialDialog suppliers={suppliers} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total"
          value={counts.total}
          icon={Boxes}
          href={totalHref}
          active={filters.status === 'all'}
        />
        <StatCard
          label="Active"
          value={counts.active}
          icon={CheckCircle2}
          href={activeHref}
          active={filters.status !== 'archived' && filters.status !== 'all'}
        />
        <StatCard
          label="Archived"
          value={counts.archived}
          icon={XCircle}
          href={archivedHref}
          active={filters.status === 'archived'}
        />
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
            <EmptyState
              icon={Boxes}
              title="No materials found"
              description="Add a material or adjust your search and filters."
              action={<NewMaterialDialog suppliers={suppliers} />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isVisible('image') && <TableHead className="w-16">Image</TableHead>}
                  {isVisible('sku') && <TableHead>SKU</TableHead>}
                  {isVisible('name') && <TableHead>Name</TableHead>}
                  {isVisible('type') && <TableHead>Type</TableHead>}
                  {isVisible('unit') && <TableHead>Unit</TableHead>}
                  {isVisible('cost') && <TableHead>Default unit cost</TableHead>}
                  {isVisible('reorder') && <TableHead>Reorder at</TableHead>}
                  {isVisible('supplier') && <TableHead>Supplier</TableHead>}
                  {isVisible('status') && <TableHead>Status</TableHead>}
                  {isVisible('actions') && (
                    <TableHead className="w-56 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span>Actions</span>
                        <ColumnVisibilityMenu
                          columns={MATERIAL_COLUMNS}
                          isVisible={isVisible}
                          onToggle={toggle}
                          onReset={reset}
                          compact
                        />
                      </div>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((m) => (
                  <TableRow key={m.id}>
                    {isVisible('image') && (
                      <TableCell>
                        <AvatarUploader
                          uploadPath={`/catalog/materials/${m.id}/image`}
                          imageUrl={m.imageUrl}
                          alt={m.name}
                        />
                      </TableCell>
                    )}
                    {isVisible('sku') && (
                      <TableCell className="font-mono text-xs">{m.sku}</TableCell>
                    )}
                    {isVisible('name') && <TableCell className="font-medium">{m.name}</TableCell>}
                    {isVisible('type') && <TableCell>{m.type}</TableCell>}
                    {isVisible('unit') && <TableCell>{m.unit}</TableCell>}
                    {isVisible('cost') && <TableCell>{m.defaultUnitCost}</TableCell>}
                    {isVisible('reorder') && (
                      <TableCell>
                        {m.reorderThresholdG ?? '—'} {m.unit}
                      </TableCell>
                    )}
                    {isVisible('supplier') && (
                      <TableCell>{m.defaultSupplier?.name ?? '—'}</TableCell>
                    )}
                    {isVisible('status') && (
                      <TableCell>
                        {m.isActive ? (
                          <Badge variant="outline">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Archived</Badge>
                        )}
                      </TableCell>
                    )}
                    {isVisible('actions') && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {m.isActive ? (
                            <ArchiveAction
                              path={`/catalog/materials/${m.id}/archive`}
                              name={m.name}
                            />
                          ) : (
                            <RestoreAction
                              path={`/catalog/materials/${m.id}/restore`}
                              name={m.name}
                            />
                          )}
                        </div>
                      </TableCell>
                    )}
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
