import { type ReactElement, useState } from 'react'
import { router, useForm } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
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
import { AvatarUploader } from '@/components/catalog/avatar-uploader'
import { ListToolbar } from '@/components/catalog/list-toolbar'
import { StatCard } from '@/components/catalog/stat-card'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ProductFilesDialog } from '@/components/catalog/product-files-dialog'
import { ProductQrDialog } from '@/components/catalog/product-qr-dialog'
import { Package, CheckCircle2, XCircle } from 'lucide-react'
import {
  ColumnVisibilityMenu,
  type ColumnDef,
} from '@/components/data-table/column-visibility'
import { useColumnVisibility } from '@/hooks/use-column-visibility'
import { EmptyState } from '@/components/empty-state'

type Row = {
  id: number
  sku: string
  name: string
  description: string | null
  category: { id: number; name: string } | null
  defaultProfitPct: string | null
  taxRatePct: string | null
  imageUrl: string | null
  isActive: boolean
  inProductionQty: number
  soldQty: number
  attachmentCount: number
}

type CategoryOpt = {
  id: number
  name: string
  defaultProfitPct: string | null
  taxRatePct: string | null
}

type Filters = { q: string; status: string; categoryId: string }

type Counts = { total: number; active: number; archived: number }

type PageProps = {
  products: Row[]
  categories: CategoryOpt[]
  filters: Filters
  counts: Counts
}

function NewProductDialog({ categories }: { categories: CategoryOpt[] }) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset, transform } = useForm({
    sku: '',
    name: '',
    description: '',
    categoryId: '',
    defaultProfitPct: '',
    taxRatePct: '',
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New product</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create product</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            transform((d) => ({
              sku: d.sku,
              name: d.name,
              description: d.description || undefined,
              categoryId: d.categoryId ? Number(d.categoryId) : undefined,
              defaultProfitPct: d.defaultProfitPct
                ? Number(d.defaultProfitPct)
                : undefined,
              taxRatePct: d.taxRatePct ? Number(d.taxRatePct) : undefined,
            }))
            post('/catalog/products', {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setOpen(false)
              },
            })
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU" error={errors.sku}>
              <Input value={data.sku} onChange={(e) => setData('sku', e.target.value)} />
            </Field>
            <Field label="Name" error={errors.name}>
              <Input value={data.name} onChange={(e) => setData('name', e.target.value)} />
            </Field>
          </div>
          <Field label="Description" error={errors.description}>
            <Input
              value={data.description}
              onChange={(e) => setData('description', e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" error={errors.categoryId}>
              <Select
                value={data.categoryId}
                onValueChange={(v) => {
                  setData('categoryId', v)
                  const cat = categories.find((c) => String(c.id) === v)
                  if (cat) {
                    setData(
                      'defaultProfitPct',
                      cat.defaultProfitPct !== null ? String(cat.defaultProfitPct) : ''
                    )
                    setData(
                      'taxRatePct',
                      cat.taxRatePct !== null ? String(cat.taxRatePct) : ''
                    )
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Default profit %" error={errors.defaultProfitPct}>
              <Input
                type="number"
                step="0.01"
                value={data.defaultProfitPct}
                onChange={(e) => setData('defaultProfitPct', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Tax rate %" error={errors.taxRatePct}>
            <Input
              type="number"
              step="0.01"
              value={data.taxRatePct}
              onChange={(e) => setData('taxRatePct', e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" variant="success" disabled={processing}>
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
      <Button
        variant="destructive"
        size="sm"
        disabled={processing}
        onClick={() => setOpen(true)}
      >
        Archive
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Archive ${name}?`}
        description="The product will be hidden from new orders and quotations. You can reactivate it later."
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

const PRODUCT_COLUMNS: ColumnDef[] = [
  { key: 'image', label: 'Image' },
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Name', required: true },
  { key: 'category', label: 'Category' },
  { key: 'inProduction', label: 'In production' },
  { key: 'sold', label: 'Sold' },
  { key: 'files', label: 'Files' },
  { key: 'profit', label: 'Profit %' },
  { key: 'tax', label: 'Tax %' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions', required: true },
]

export default function ProductsPage({ products, categories, filters, counts }: PageProps) {
  const { isVisible, toggle, reset } = useColumnVisibility('catalog.products')
  const baseQs =
    filters.categoryId && filters.categoryId !== 'all' ? `&categoryId=${filters.categoryId}` : ''
  const totalHref = `/catalog/products${baseQs ? `?${baseQs.slice(1)}` : ''}`
  const activeHref = `/catalog/products?status=active${baseQs}`
  const archivedHref = `/catalog/products?status=archived${baseQs}`
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground">
            {products.length} products in catalog.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NewProductDialog categories={categories} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total"
          value={counts.total}
          icon={Package}
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
        basePath="/catalog/products"
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

      <Card>
        <CardHeader>
          <CardTitle>All products</CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products found"
              description="Add a product or adjust your search and filters."
              action={<NewProductDialog categories={categories} />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isVisible('image') && <TableHead className="w-16">Image</TableHead>}
                  {isVisible('sku') && <TableHead>SKU</TableHead>}
                  {isVisible('name') && <TableHead>Name</TableHead>}
                  {isVisible('category') && <TableHead>Category</TableHead>}
                  {isVisible('inProduction') && (
                    <TableHead className="text-right">In production</TableHead>
                  )}
                  {isVisible('sold') && (
                    <TableHead className="text-right">Sold</TableHead>
                  )}
                  {isVisible('files') && (
                    <TableHead className="text-right">Files</TableHead>
                  )}
                  {isVisible('profit') && <TableHead>Profit %</TableHead>}
                  {isVisible('tax') && <TableHead>Tax %</TableHead>}
                  {isVisible('status') && <TableHead>Status</TableHead>}
                  {isVisible('actions') && (
                    <TableHead className="w-72 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span>Actions</span>
                        <ColumnVisibilityMenu
                          columns={PRODUCT_COLUMNS}
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
                {products.map((p) => (
                  <TableRow key={p.id}>
                    {isVisible('image') && (
                      <TableCell>
                        <AvatarUploader
                          uploadPath={`/catalog/products/${p.id}/image`}
                          imageUrl={p.imageUrl}
                          alt={p.name}
                        />
                      </TableCell>
                    )}
                    {isVisible('sku') && (
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    )}
                    {isVisible('name') && (
                      <TableCell className="font-medium">
                        {p.name}
                        {p.category?.name === 'Custom Orders' && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">Custom</Badge>
                        )}
                      </TableCell>
                    )}
                    {isVisible('category') && (
                      <TableCell>{p.category?.name ?? '—'}</TableCell>
                    )}
                    {isVisible('inProduction') && (
                      <TableCell className="text-right tabular-nums">
                        {p.inProductionQty > 0 ? p.inProductionQty : '—'}
                      </TableCell>
                    )}
                    {isVisible('sold') && (
                      <TableCell className="text-right tabular-nums">
                        {p.soldQty > 0 ? p.soldQty : '—'}
                      </TableCell>
                    )}
                    {isVisible('files') && (
                      <TableCell className="text-right tabular-nums">
                        {p.attachmentCount > 0 ? p.attachmentCount : '—'}
                      </TableCell>
                    )}
                    {isVisible('profit') && (
                      <TableCell>{p.defaultProfitPct ?? '—'}</TableCell>
                    )}
                    {isVisible('tax') && (
                      <TableCell>{p.taxRatePct ?? '—'}</TableCell>
                    )}
                    {isVisible('status') && (
                      <TableCell>
                        {p.isActive ? (
                          <Badge variant="outline">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Archived</Badge>
                        )}
                      </TableCell>
                    )}
                    {isVisible('actions') && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/catalog/products/${p.id}`}>View</Link>
                          </Button>
                          <ProductFilesDialog
                            productId={p.id}
                            productName={p.name}
                            initialCount={p.attachmentCount}
                          />
                          <ProductQrDialog productId={p.id} productName={p.name} />
                          {p.isActive ? (
                            <ArchiveAction
                              path={`/catalog/products/${p.id}/archive`}
                              name={p.name}
                            />
                          ) : (
                            <RestoreAction
                              path={`/catalog/products/${p.id}/restore`}
                              name={p.name}
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

ProductsPage.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
// router import is implicit via <ListToolbar>; keep this so vite tree-shakes properly
void router
