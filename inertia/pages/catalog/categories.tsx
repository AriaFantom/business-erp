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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import DashboardLayout from '@/layouts/dashboard-layout'
import { ListToolbar } from '@/components/catalog/list-toolbar'
import { StatCard } from '@/components/catalog/stat-card'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Tag, CheckCircle2, XCircle } from 'lucide-react'
import { ColumnVisibilityMenu, type ColumnDef } from '@/components/data-table/column-visibility'
import { useColumnVisibility } from '@/hooks/use-column-visibility'
import { EmptyState } from '@/components/empty-state'

type Row = {
  id: number
  name: string
  defaultProfitPct: string | null
  taxRatePct: string | null
  isActive: boolean
  totalSales: number
  totalUnitsSold: number
  productCount: number
}

type Filters = { q: string; status: string }

type Counts = { total: number; active: number; archived: number }

type PageProps = { categories: Row[]; filters: Filters; counts: Counts }

function NewCategoryDialog() {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset, transform } = useForm({
    name: '',
    defaultProfitPct: '',
    taxRatePct: '',
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New category</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create category</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            transform((d) => ({
              name: d.name,
              defaultProfitPct: d.defaultProfitPct ? Number(d.defaultProfitPct) : undefined,
              taxRatePct: d.taxRatePct ? Number(d.taxRatePct) : undefined,
            }))
            post('/catalog/categories', {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setOpen(false)
              },
            })
          }}
        >
          <Field label="Name" error={errors.name}>
            <Input
              placeholder="e.g. Bags, Home decor"
              value={data.name}
              onChange={(e) => setData('name', e.target.value)}
            />
          </Field>
          <Field label="Default profit %" error={errors.defaultProfitPct}>
            <Input
              type="number"
              step="0.01"
              placeholder="e.g. 30"
              value={data.defaultProfitPct}
              onChange={(e) => setData('defaultProfitPct', e.target.value)}
            />
          </Field>
          <Field label="Tax rate %" error={errors.taxRatePct}>
            <Input
              type="number"
              step="0.01"
              placeholder="e.g. 18"
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
      <Button variant="destructive" size="sm" disabled={processing} onClick={() => setOpen(true)}>
        Archive
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Archive ${name}?`}
        description="The category will be hidden from new product assignments. You can reactivate it later."
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

function formatMoney(n: number): string {
  return `₹${n.toFixed(2)}`
}

const CATEGORY_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'profit', label: 'Default profit %' },
  { key: 'tax', label: 'Tax %' },
  { key: 'products', label: 'Products' },
  { key: 'sales', label: 'Total sales' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions', required: true },
]

export default function CategoriesPage({ categories, filters, counts }: PageProps) {
  const { isVisible, toggle, reset } = useColumnVisibility('catalog.categories')
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Product categories</h1>
          <p className="text-sm text-muted-foreground">{categories.length} categories.</p>
        </div>
        <NewCategoryDialog />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total"
          value={counts.total}
          icon={Tag}
          href="/catalog/categories"
          active={filters.status === 'all'}
        />
        <StatCard
          label="Active"
          value={counts.active}
          icon={CheckCircle2}
          href="/catalog/categories?status=active"
          active={filters.status !== 'archived' && filters.status !== 'all'}
        />
        <StatCard
          label="Archived"
          value={counts.archived}
          icon={XCircle}
          href="/catalog/categories?status=archived"
          active={filters.status === 'archived'}
        />
      </div>

      <ListToolbar
        basePath="/catalog/categories"
        q={filters.q}
        searchPlaceholder="Search categories…"
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
          <CardTitle>All categories</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="No categories found"
              description="Add a category or adjust your search and filters."
              action={<NewCategoryDialog />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isVisible('name') && <TableHead>Name</TableHead>}
                  {isVisible('profit') && <TableHead>Default profit %</TableHead>}
                  {isVisible('tax') && <TableHead>Tax %</TableHead>}
                  {isVisible('products') && <TableHead className="text-right">Products</TableHead>}
                  {isVisible('sales') && <TableHead className="text-right">Total sales</TableHead>}
                  {isVisible('status') && <TableHead>Status</TableHead>}
                  {isVisible('actions') && (
                    <TableHead className="w-40 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span>Actions</span>
                        <ColumnVisibilityMenu
                          columns={CATEGORY_COLUMNS}
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
                {categories.map((c) => (
                  <TableRow key={c.id}>
                    {isVisible('name') && <TableCell className="font-medium">{c.name}</TableCell>}
                    {isVisible('profit') && <TableCell>{c.defaultProfitPct ?? '—'}</TableCell>}
                    {isVisible('tax') && <TableCell>{c.taxRatePct ?? '—'}</TableCell>}
                    {isVisible('products') && (
                      <TableCell className="text-right tabular-nums">{c.productCount}</TableCell>
                    )}
                    {isVisible('sales') && (
                      <TableCell className="text-right tabular-nums">
                        <div className="flex flex-col items-end">
                          <span>{formatMoney(c.totalSales)}</span>
                          {c.totalUnitsSold > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {c.totalUnitsSold} units
                            </span>
                          )}
                        </div>
                      </TableCell>
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
                          {c.isActive ? (
                            <ArchiveAction
                              path={`/catalog/categories/${c.id}/archive`}
                              name={c.name}
                            />
                          ) : (
                            <RestoreAction
                              path={`/catalog/categories/${c.id}/restore`}
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
    </div>
  )
}

CategoriesPage.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
