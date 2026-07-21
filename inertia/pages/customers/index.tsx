import { type ReactElement, useState } from 'react'
import { useForm } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Archive, CheckCircle2, Users, XCircle } from 'lucide-react'
import { ListToolbar } from '@/components/catalog/list-toolbar'
import { StatCard } from '@/components/catalog/stat-card'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'

type Row = {
  id: number
  name: string
  gstin: string | null
  email: string | null
  phone: string | null
  isActive: boolean
  creditLimit: string | null
  openBalance: string
}

type Filters = { q: string; status: string }

type Counts = { total: number; active: number; archived: number }

type PageProps = { customers: Row[]; filters: Filters; counts: Counts }

function NewCustomerDialog() {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset, transform } = useForm({
    name: '',
    gstin: '',
    email: '',
    phone: '',
    billingAddress: '',
    shippingAddress: '',
    creditLimit: '',
  })
  transform((d) => ({
    ...d,
    creditLimit: d.creditLimit === '' ? null : Number(d.creditLimit),
  }))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New customer</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create customer</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            post('/customers', {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setOpen(false)
              },
            })
          }}
        >
          <Field
            label="Name"
            placeholder="e.g. Anita Sharma or Acme Retail Pvt Ltd"
            value={data.name}
            error={errors.name}
            onChange={(v) => setData('name', v)}
          />
          <Field
            label="GSTIN"
            placeholder="15-character GST number"
            value={data.gstin}
            error={errors.gstin}
            onChange={(v) => setData('gstin', v)}
          />
          <Field
            label="Email"
            type="email"
            placeholder="name@example.com"
            value={data.email}
            error={errors.email}
            onChange={(v) => setData('email', v)}
          />
          <Field
            label="Phone"
            placeholder="10-digit mobile number"
            value={data.phone}
            error={errors.phone}
            onChange={(v) => setData('phone', v)}
          />
          <Field
            label="Billing address"
            placeholder="Street, city, state, PIN"
            value={data.billingAddress}
            error={errors.billingAddress}
            onChange={(v) => setData('billingAddress', v)}
          />
          <Field
            label="Shipping address"
            placeholder="Leave empty to use the billing address"
            value={data.shippingAddress}
            error={errors.shippingAddress}
            onChange={(v) => setData('shippingAddress', v)}
          />
          <div className="flex flex-col gap-1">
            <Label>Credit limit</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={data.creditLimit}
              placeholder="No limit"
              onChange={(e) => setData('creditLimit', e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              Blocks new credit sales when unpaid invoices exceed this. Leave empty for no limit.
            </span>
            {errors.creditLimit && (
              <span className="text-xs text-destructive">{errors.creditLimit}</span>
            )}
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
  value,
  error,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  error?: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

function CreditLimitDialog({ customer }: { customer: Row }) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, transform } = useForm({
    creditLimit: customer.creditLimit ?? '',
  })
  transform((d) => ({ creditLimit: d.creditLimit === '' ? null : Number(d.creditLimit) }))
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Set credit limit">
          {customer.creditLimit ? Number(customer.creditLimit).toFixed(2) : 'No limit'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Credit limit — {customer.name}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            post(`/customers/${customer.id}`, {
              preserveScroll: true,
              onSuccess: () => setOpen(false),
            })
          }}
        >
          <div className="flex flex-col gap-1">
            <Label>Credit limit</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={data.creditLimit}
              placeholder="No limit"
              onChange={(e) => setData('creditLimit', e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              Current open balance: {customer.openBalance}. Leave empty for no limit.
            </span>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={processing}>
              {processing ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ArchiveAction({ path, confirmText }: { path: string; confirmText: string }) {
  const { post, processing } = useForm()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="destructive"
        size="icon"
        disabled={processing}
        aria-label="Archive customer"
        title="Archive"
        onClick={() => setOpen(true)}
      >
        <Archive className="size-4" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={confirmText}
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={() => post(path, { preserveScroll: true })}
      />
    </>
  )
}

export default function CustomersIndex({ customers, filters, counts }: PageProps) {
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
        </div>
        <NewCustomerDialog />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total"
          value={counts.total}
          icon={Users}
          href="/customers"
          active={filters.status === 'all'}
        />
        <StatCard
          label="Active"
          value={counts.active}
          icon={CheckCircle2}
          href="/customers?status=active"
          active={filters.status !== 'archived' && filters.status !== 'all'}
        />
        <StatCard
          label="Archived"
          value={counts.archived}
          icon={XCircle}
          href="/customers?status=archived"
          active={filters.status === 'archived'}
        />
      </div>

      <ListToolbar
        basePath="/customers"
        q={filters.q}
        searchPlaceholder="Search by name, email, phone, GSTIN…"
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
          <CardTitle>All customers</CardTitle>
          <CardDescription>People and businesses you sell to.</CardDescription>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No customers yet"
              description="Add a customer to start quoting and selling."
              action={<NewCustomerDialog />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Open balance</TableHead>
                  <TableHead className="text-right">Credit limit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.gstin ?? '—'}</TableCell>
                    <TableCell>{c.email ?? '—'}</TableCell>
                    <TableCell>{c.phone ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(c.openBalance) > 0 ? (
                        <span className="font-medium">{c.openBalance}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <CreditLimitDialog customer={c} />
                    </TableCell>
                    <TableCell>
                      {c.isActive ? (
                        <Badge variant="outline">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Archived</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.isActive && (
                        <ArchiveAction
                          path={`/customers/${c.id}/archive`}
                          confirmText={`Archive ${c.name}?`}
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

CustomersIndex.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
