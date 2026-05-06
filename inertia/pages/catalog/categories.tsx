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
import DashboardLayout from '@/layouts/dashboard-layout'
import { ListToolbar } from '@/components/catalog/list-toolbar'

type Row = {
  id: number
  name: string
  defaultProfitPct: string | null
  taxRatePct: string | null
}

type PageProps = { categories: Row[]; filters: { q: string } }

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
              defaultProfitPct: d.defaultProfitPct
                ? Number(d.defaultProfitPct)
                : undefined,
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
          <Row label="Name" error={errors.name}>
            <Input value={data.name} onChange={(e) => setData('name', e.target.value)} />
          </Row>
          <Row label="Default profit %" error={errors.defaultProfitPct}>
            <Input
              type="number"
              step="0.01"
              value={data.defaultProfitPct}
              onChange={(e) => setData('defaultProfitPct', e.target.value)}
            />
          </Row>
          <Row label="Tax rate %" error={errors.taxRatePct}>
            <Input
              type="number"
              step="0.01"
              value={data.taxRatePct}
              onChange={(e) => setData('taxRatePct', e.target.value)}
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

function DeleteAction({ path, name }: { path: string; name: string }) {
  const { post, processing } = useForm()
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={processing}
      onClick={() => {
        if (window.confirm(`Delete category "${name}"?`)) post(path, { preserveScroll: true })
      }}
    >
      Delete
    </Button>
  )
}

export default function CategoriesPage({ categories, filters }: PageProps) {
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Product categories</h1>
          <p className="text-sm text-muted-foreground">
            {categories.length} categories.
          </p>
        </div>
        <NewCategoryDialog />
      </div>

      <ListToolbar
        basePath="/catalog/categories"
        q={filters.q}
        searchPlaceholder="Search categories…"
      />

      <Card>
        <CardHeader>
          <CardTitle>All categories</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Default profit %</TableHead>
                  <TableHead>Tax %</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.defaultProfitPct ?? '—'}</TableCell>
                    <TableCell>{c.taxRatePct ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <DeleteAction
                        path={`/catalog/categories/${c.id}/delete`}
                        name={c.name}
                      />
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

CategoriesPage.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
