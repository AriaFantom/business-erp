import { type ReactElement, useState } from 'react'
import { useForm } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { CheckCircle2, ExternalLink, Factory, Loader2 } from 'lucide-react'
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
import { ListToolbar } from '@/components/catalog/list-toolbar'
import { StatCard } from '@/components/catalog/stat-card'
import {
  ColumnVisibilityMenu,
  type ColumnDef,
} from '@/components/data-table/column-visibility'
import { useColumnVisibility } from '@/hooks/use-column-visibility'

type JobRow = {
  id: number
  number: string
  productId: number
  productName: string
  status: string
  plannedQty: number
  producedQty: number
  totalCost: string
  unitCost: string
  parentJobId: number | null
  createdAt: string | null
}

type ProductOpt = { id: number; sku: string; name: string }

type Filters = { q: string; status: string; productId: string }

type PageProps = { jobs: JobRow[]; products: ProductOpt[]; filters: Filters }

function NewJobDialog({ products }: { products: ProductOpt[] }) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset, transform } = useForm({
    productId: 0,
    plannedQty: 1,
    parentJobId: '',
    note: '',
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New job</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create production job</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            transform((d) => ({
              productId: d.productId,
              plannedQty: d.plannedQty,
              parentJobId: d.parentJobId ? Number(d.parentJobId) : undefined,
              note: d.note || undefined,
            }))
            post('/jobs', {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setOpen(false)
              },
            })
          }}
        >
          <Field label="Product" error={errors.productId}>
            <Select
              value={data.productId ? String(data.productId) : ''}
              onValueChange={(v) => setData('productId', Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} ({p.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Planned qty" error={errors.plannedQty}>
            <Input
              type="number"
              value={data.plannedQty}
              onChange={(e) => setData('plannedQty', Number(e.target.value))}
            />
          </Field>
          <Field label="Parent job ID (for reprints)" error={errors.parentJobId}>
            <Input
              type="number"
              value={data.parentJobId}
              onChange={(e) => setData('parentJobId', e.target.value)}
            />
          </Field>
          <Field label="Note" error={errors.note}>
            <Input value={data.note} onChange={(e) => setData('note', e.target.value)} />
          </Field>
          <DialogFooter>
            <Button
              type="submit"
              variant="success"
              disabled={processing || !data.productId}
            >
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

function statusVariant(s: string) {
  if (s === 'completed') return 'default' as const
  if (s === 'failed' || s === 'cancelled') return 'destructive' as const
  if (s === 'in_progress') return 'secondary' as const
  return 'outline' as const
}

const JOB_COLUMNS: ColumnDef[] = [
  { key: 'number', label: 'Number', required: true },
  { key: 'product', label: 'Product' },
  { key: 'status', label: 'Status' },
  { key: 'planned', label: 'Planned' },
  { key: 'produced', label: 'Produced' },
  { key: 'totalCost', label: 'Total cost' },
  { key: 'unitCost', label: 'Unit cost' },
  { key: 'actions', label: 'Actions', required: true },
]

export default function JobsIndex({ jobs, products, filters }: PageProps) {
  const { isVisible, toggle, reset } = useColumnVisibility('jobs')
  const inProgress = jobs.filter((j) => j.status === 'in_progress').length
  const completed = jobs.filter((j) => j.status === 'completed').length
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Production jobs</h1>
        </div>
        <div className="flex items-center gap-2">
          <NewJobDialog products={products} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total jobs" value={jobs.length} icon={Factory} />
        <StatCard label="In progress" value={inProgress} icon={Loader2} />
        <StatCard label="Completed" value={completed} icon={CheckCircle2} />
      </div>

      <ListToolbar
        basePath="/jobs"
        q={filters.q}
        searchPlaceholder="Search by job number…"
        selects={[
          {
            name: 'status',
            value: filters.status,
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'in_progress', label: 'In progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'failed', label: 'Failed' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
          {
            name: 'productId',
            value: filters.productId,
            options: [
              { value: 'all', label: 'All products' },
              ...products.map((p) => ({ value: String(p.id), label: p.name })),
            ],
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>All jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isVisible('number') && <TableHead>Number</TableHead>}
                  {isVisible('product') && <TableHead>Product</TableHead>}
                  {isVisible('status') && <TableHead>Status</TableHead>}
                  {isVisible('planned') && (
                    <TableHead className="text-right">Planned</TableHead>
                  )}
                  {isVisible('produced') && (
                    <TableHead className="text-right">Produced</TableHead>
                  )}
                  {isVisible('totalCost') && (
                    <TableHead className="text-right">Total cost</TableHead>
                  )}
                  {isVisible('unitCost') && (
                    <TableHead className="text-right">Unit cost</TableHead>
                  )}
                  {isVisible('actions') && (
                    <TableHead className="w-20 text-right">
                      <ColumnVisibilityMenu
                        columns={JOB_COLUMNS}
                        isVisible={isVisible}
                        onToggle={toggle}
                        onReset={reset}
                        compact
                      />
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id}>
                    {isVisible('number') && (
                      <TableCell className="font-mono text-xs">{j.number}</TableCell>
                    )}
                    {isVisible('product') && <TableCell>{j.productName}</TableCell>}
                    {isVisible('status') && (
                      <TableCell>
                        <Badge variant={statusVariant(j.status)}>{j.status}</Badge>
                      </TableCell>
                    )}
                    {isVisible('planned') && (
                      <TableCell className="text-right">{j.plannedQty}</TableCell>
                    )}
                    {isVisible('produced') && (
                      <TableCell className="text-right">{j.producedQty}</TableCell>
                    )}
                    {isVisible('totalCost') && (
                      <TableCell className="text-right">{j.totalCost}</TableCell>
                    )}
                    {isVisible('unitCost') && (
                      <TableCell className="text-right">{j.unitCost}</TableCell>
                    )}
                    {isVisible('actions') && (
                      <TableCell className="text-right">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          aria-label="Open job"
                        >
                          <Link href={`/jobs/${j.id}`}>
                            <ExternalLink className="size-4" />
                          </Link>
                        </Button>
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

JobsIndex.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
