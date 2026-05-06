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
import { ListToolbar } from '@/components/catalog/list-toolbar'

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

export default function ProductsPage({ products, categories, filters }: PageProps) {
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground">
            {products.length} products in catalog.
          </p>
        </div>
        <NewProductDialog categories={categories} />
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
                  <TableHead className="w-16">Image</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Profit %</TableHead>
                  <TableHead>Tax %</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-48 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Thumb url={p.imageUrl} alt={p.name} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.category?.name ?? '—'}</TableCell>
                    <TableCell>{p.defaultProfitPct ?? '—'}</TableCell>
                    <TableCell>{p.taxRatePct ?? '—'}</TableCell>
                    <TableCell>
                      {p.isActive ? (
                        <Badge variant="outline">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Archived</Badge>
                      )}
                    </TableCell>
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

ProductsPage.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
// router import is implicit via <ListToolbar>; keep this so vite tree-shakes properly
void router
