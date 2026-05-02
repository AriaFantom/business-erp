import { type ReactElement, useState } from 'react'
import { useForm } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

type Row = {
  id: number
  name: string
  gstin: string | null
  email: string | null
  phone: string | null
  isActive: boolean
}

type PageProps = { customers: Row[] }

function NewCustomerDialog() {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset } = useForm({
    name: '',
    gstin: '',
    email: '',
    phone: '',
    billingAddress: '',
    shippingAddress: '',
  })

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
          <Field label="Name" value={data.name} error={errors.name} onChange={(v) => setData('name', v)} />
          <Field label="GSTIN" value={data.gstin} error={errors.gstin} onChange={(v) => setData('gstin', v)} />
          <Field label="Email" type="email" value={data.email} error={errors.email} onChange={(v) => setData('email', v)} />
          <Field label="Phone" value={data.phone} error={errors.phone} onChange={(v) => setData('phone', v)} />
          <Field
            label="Billing address"
            value={data.billingAddress}
            error={errors.billingAddress}
            onChange={(v) => setData('billingAddress', v)}
          />
          <Field
            label="Shipping address"
            value={data.shippingAddress}
            error={errors.shippingAddress}
            onChange={(v) => setData('shippingAddress', v)}
          />
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
}: {
  label: string
  value: string
  error?: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

function ArchiveAction({ path, confirmText }: { path: string; confirmText: string }) {
  const { post, processing } = useForm()
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={processing}
      onClick={() => {
        if (window.confirm(confirmText)) post(path, { preserveScroll: true })
      }}
    >
      Archive
    </Button>
  )
}

export default function CustomersIndex({ customers }: PageProps) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground">{customers.length} customers</p>
        </div>
        <NewCustomerDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All customers</CardTitle>
          <CardDescription>People and businesses you sell to.</CardDescription>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No customers yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
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
                    <TableCell>
                      {c.isActive ? <Badge variant="outline">Active</Badge> : <Badge variant="secondary">Archived</Badge>}
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
