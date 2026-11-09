import { type ReactElement, useState } from 'react'
import { useForm, usePage } from '@inertiajs/react'
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
  SelectGroup,
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
import { Archive, CheckCircle2, Pencil, Puzzle, RotateCcw, XCircle } from 'lucide-react'
import { ColumnVisibilityMenu, type ColumnDef } from '@/components/data-table/column-visibility'
import { useColumnVisibility } from '@/hooks/use-column-visibility'
import { EmptyState } from '@/components/empty-state'
import { SkuField } from '@/components/catalog/sku-field'
import { EditItemNameDialog } from '@/components/catalog/edit-item-name-dialog'
import { formatMoney, useCurrency } from '@/lib/currency'
import type { InertiaProps } from '@/types'
import { DeletePermanentlyAction } from '@/components/catalog/delete-permanently-action'

type Row = {
  id: number
  sku: string
  name: string
  unit: string
  defaultUnitCost: string
  reorderThresholdQty: number | null
  defaultSupplier: { id: number; name: string } | null
  imageUrl: string | null
  isActive: boolean
  deleteBlocker: string | null
}

type SupplierOpt = { id: number; name: string }

type Filters = { q: string; status: string }

type Counts = { total: number; active: number; archived: number }

type PageProps = {
  components: Row[]
  suppliers: SupplierOpt[]
  filters: Filters
  counts: Counts
}

function NewComponentDialog({ suppliers }: { suppliers: SupplierOpt[] }) {
  const currency = useCurrency()
  const [open, setOpen] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const { data, setData, post, processing, errors, reset, transform } = useForm({
    sku: '',
    name: '',
    unit: 'pcs',
    defaultSupplierId: '',
    defaultUnitCost: 0,
    reorderThresholdQty: '',
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setImageFile(null)
      }}
    >
      <DialogTrigger asChild>
        <Button>New component</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create component</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            transform((d) => {
              const out: Record<string, unknown> = {
                sku: d.sku,
                name: d.name,
                unit: d.unit || 'pcs',
                defaultSupplierId: d.defaultSupplierId ? Number(d.defaultSupplierId) : undefined,
                defaultUnitCost: d.defaultUnitCost,
                reorderThresholdQty: d.reorderThresholdQty
                  ? Number(d.reorderThresholdQty)
                  : undefined,
              }
              if (imageFile) out.image = imageFile
              return out as never
            })
            post('/catalog/components', {
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <SkuField
              id="component-sku"
              name={data.name}
              value={data.sku}
              onChange={(sku) => setData('sku', sku)}
              error={errors.sku}
            />
            <Field label="Name" error={errors.name}>
              <Input
                placeholder="e.g. Zipper 8 inch"
                value={data.name}
                onChange={(e) => setData('name', e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <Field label="Unit of measure" error={errors.unit}>
              <UnitPicker value={data.unit} onChange={(v) => setData('unit', v)} />
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
                  <SelectGroup>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <Field
              label={`Default unit cost (${currency}, per ${data.unit || 'unit'})`}
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
              error={errors.reorderThresholdQty}
            >
              <Input
                type="number"
                placeholder="Alert when stock drops below this"
                value={data.reorderThresholdQty}
                onChange={(e) => setData('reorderThresholdQty', e.target.value)}
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
    <div className="flex min-w-0 flex-col gap-2 [&_[data-slot=select-trigger]]:w-full [&_input]:w-full">
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
      <Button
        variant="destructive"
        size="icon"
        disabled={processing}
        aria-label={`Archive ${name}`}
        title="Archive"
        onClick={() => setOpen(true)}
      >
        <Archive />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Archive ${name}?`}
        description="The component will be hidden from new purchases and jobs. You can reactivate it later."
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
      size="icon"
      disabled={processing}
      onClick={() => post(path, { preserveScroll: true })}
      aria-label={`Restore ${name}`}
      title={`Restore ${name}`}
    >
      <RotateCcw />
    </Button>
  )
}

const COMPONENT_COLUMNS: ColumnDef[] = [
  { key: 'image', label: 'Image' },
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Name', required: true },
  { key: 'unit', label: 'Unit' },
  { key: 'cost', label: 'Default cost' },
  { key: 'reorder', label: 'Reorder at' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions', required: true },
]

export default function ComponentsPage({ components, suppliers, filters, counts }: PageProps) {
  const currency = useCurrency()
  const { user } = usePage<InertiaProps<PageProps>>().props
  const canEdit = Boolean(user?.isOwner || user?.permissions?.includes('components.update'))
  const canDelete = Boolean(user?.isOwner || user?.permissions?.includes('components.delete'))
  const [editing, setEditing] = useState<Row | null>(null)
  const { isVisible, toggle, reset } = useColumnVisibility('catalog.components')
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Components</h1>
          <p className="text-sm text-muted-foreground">{components.length} components.</p>
        </div>
        <NewComponentDialog suppliers={suppliers} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total"
          value={counts.total}
          icon={Puzzle}
          href="/catalog/components"
          active={filters.status === 'all'}
        />
        <StatCard
          label="Active"
          value={counts.active}
          icon={CheckCircle2}
          href="/catalog/components?status=active"
          active={filters.status !== 'archived' && filters.status !== 'all'}
        />
        <StatCard
          label="Archived"
          value={counts.archived}
          icon={XCircle}
          href="/catalog/components?status=archived"
          active={filters.status === 'archived'}
        />
      </div>

      <ListToolbar
        basePath="/catalog/components"
        q={filters.q}
        searchPlaceholder="Search by name or SKU…"
        selects={[
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
          <CardTitle>All components</CardTitle>
        </CardHeader>
        <CardContent>
          {components.length === 0 ? (
            <EmptyState
              icon={Puzzle}
              title="No components found"
              description="Add a component or adjust your search and filters."
              action={<NewComponentDialog suppliers={suppliers} />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isVisible('image') && <TableHead className="w-16">Image</TableHead>}
                  {isVisible('sku') && <TableHead>SKU</TableHead>}
                  {isVisible('name') && <TableHead>Name</TableHead>}
                  {isVisible('unit') && <TableHead>Unit</TableHead>}
                  {isVisible('cost') && <TableHead>Default cost</TableHead>}
                  {isVisible('reorder') && <TableHead>Reorder at</TableHead>}
                  {isVisible('supplier') && <TableHead>Supplier</TableHead>}
                  {isVisible('status') && <TableHead>Status</TableHead>}
                  {isVisible('actions') && (
                    <TableHead className="w-56 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span>Actions</span>
                        <ColumnVisibilityMenu
                          columns={COMPONENT_COLUMNS}
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
                {components.map((c) => (
                  <TableRow key={c.id}>
                    {isVisible('image') && (
                      <TableCell>
                        <AvatarUploader
                          uploadPath={`/catalog/components/${c.id}/image`}
                          imageUrl={c.imageUrl}
                          alt={c.name}
                        />
                      </TableCell>
                    )}
                    {isVisible('sku') && (
                      <TableCell className="font-mono text-xs">{c.sku}</TableCell>
                    )}
                    {isVisible('name') && <TableCell className="font-medium">{c.name}</TableCell>}
                    {isVisible('unit') && <TableCell>{c.unit}</TableCell>}
                    {isVisible('cost') && (
                      <TableCell>
                        {formatMoney(c.defaultUnitCost, currency, { maximumFractionDigits: 4 })}
                      </TableCell>
                    )}
                    {isVisible('reorder') && (
                      <TableCell>
                        {c.reorderThresholdQty ?? '—'} {c.unit}
                      </TableCell>
                    )}
                    {isVisible('supplier') && (
                      <TableCell>{c.defaultSupplier?.name ?? '—'}</TableCell>
                    )}
                    {isVisible('status') && (
                      <TableCell>
                        {c.isActive ? (
                          <Badge variant="outline">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Archived</Badge>
                        )}
                      </TableCell>
                    )}
                    {isVisible('actions') && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canEdit && (
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label={`Edit ${c.name}`}
                              title="Edit name"
                              onClick={() => setEditing(c)}
                            >
                              <Pencil />
                            </Button>
                          )}
                          {canDelete && (
                            <DeletePermanentlyAction
                              path={`/catalog/components/${c.id}/delete`}
                              name={c.name}
                              blockedReason={c.deleteBlocker}
                            />
                          )}
                          {c.isActive ? (
                            <ArchiveAction
                              path={`/catalog/components/${c.id}/archive`}
                              name={c.name}
                            />
                          ) : (
                            <RestoreAction
                              path={`/catalog/components/${c.id}/restore`}
                              name={c.name}
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
      {editing && (
        <EditItemNameDialog
          kind="component"
          id={editing.id}
          name={editing.name}
          sku={editing.sku}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
    </div>
  )
}

ComponentsPage.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
