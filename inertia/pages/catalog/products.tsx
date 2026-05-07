import { type ReactElement, useState } from 'react'
import { router, useForm } from '@inertiajs/react'
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
import { AvatarUploader } from '@/components/catalog/avatar-uploader'
import { ListToolbar } from '@/components/catalog/list-toolbar'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  ColumnVisibilityMenu,
  type ColumnDef,
} from '@/components/data-table/column-visibility'
import { useColumnVisibility } from '@/hooks/use-column-visibility'

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
}

type CategoryOpt = {
  id: number
  name: string
  defaultProfitPct: string | null
  taxRatePct: string | null
}

type Filters = { q: string; status: string; categoryId: string }

type PageProps = { products: Row[]; categories: CategoryOpt[]; filters: Filters }

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
          className="flex flex-col gap-3"
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
          <Field label="SKU" error={errors.sku}>
            <Input value={data.sku} onChange={(e) => setData('sku', e.target.value)} />
          </Field>
          <Field label="Name" error={errors.name}>
            <Input value={data.name} onChange={(e) => setData('name', e.target.value)} />
          </Field>
          <Field label="Description" error={errors.description}>
            <Input
              value={data.description}
              onChange={(e) => setData('description', e.target.value)}
            />
          </Field>
          <Field label="Category" error={errors.categoryId}>
            <Select
              value={data.categoryId}
              onValueChange={(v) => setData('categoryId', v)}
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Default profit %" error={errors.defaultProfitPct}>
              <Input
                type="number"
                step="0.01"
                value={data.defaultProfitPct}
                onChange={(e) => setData('defaultProfitPct', e.target.value)}
              />
            </Field>
            <Field label="Tax rate %" error={errors.taxRatePct}>
              <Input
                type="number"
                step="0.01"
                value={data.taxRatePct}
                onChange={(e) => setData('taxRatePct', e.target.value)}
              />
            </Field>
          </div>
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
        description="The product will be hidden from new sales and quotations. You can reactivate it later."
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={() => post(path, { preserveScroll: true })}
      />
    </>
  )
}

const PRODUCT_COLUMNS: ColumnDef[] = [
  { key: 'image', label: 'Image' },
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Name', required: true },
  { key: 'category', label: 'Category' },
  { key: 'inProduction', label: 'In production' },
  { key: 'sold', label: 'Sold' },
  { key: 'profit', label: 'Profit %' },
  { key: 'tax', label: 'Tax %' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions', required: true },
]

export default function ProductsPage({ products, categories, filters }: PageProps) {
  const { isVisible, toggle, reset } = useColumnVisibility('catalog.products')
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
          <ColumnVisibilityMenu
            columns={PRODUCT_COLUMNS}
            isVisible={isVisible}
            onToggle={toggle}
            onReset={reset}
          />
          <NewProductDialog categories={categories} />
        </div>
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
            <p className="text-sm text-muted-foreground">No products match the filters.</p>
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
                  {isVisible('profit') && <TableHead>Profit %</TableHead>}
                  {isVisible('tax') && <TableHead>Tax %</TableHead>}
                  {isVisible('status') && <TableHead>Status</TableHead>}
                  {isVisible('actions') && (
                    <TableHead className="w-48 text-right">Actions</TableHead>
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
                      <TableCell className="font-medium">{p.name}</TableCell>
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
                        <div className="flex justify-end gap-2">
                          <ImageUploader
                            uploadPath={`/catalog/products/${p.id}/image`}
                            deletePath={`/catalog/products/${p.id}/image/delete`}
                            hasImage={!!p.imageUrl}
                          />
                          {p.isActive && (
                            <ArchiveAction
                              path={`/catalog/products/${p.id}/archive`}
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
