import { type ReactElement } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { CheckCircle2, ExternalLink, Receipt, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/status-badge'
import { EmptyState } from '@/components/empty-state'
import DashboardLayout from '@/layouts/dashboard-layout'
import { ListToolbar } from '@/components/catalog/list-toolbar'
import { StatCard } from '@/components/catalog/stat-card'

type InvoiceRow = {
  id: number
  number: string
  orderId: number
  customerId: number
  customerName: string
  status: string
  issuedAt: string | null
  dueAt: string | null
  total: string
  paidTotal: string
  balance: string
  overdueDays: number
}

type CustomerOpt = { id: number; name: string }

type Filters = { q: string; status: string; customerId: string }

type Aging = {
  current: number
  d1_30: number
  d31_60: number
  d61_90: number
  d90plus: number
}

type PageProps = {
  invoices: InvoiceRow[]
  customers: CustomerOpt[]
  filters: Filters
  aging: Aging
}

function AgingStrip({ aging }: { aging: Aging }) {
  const buckets = [
    { label: 'Current', value: aging.current },
    { label: '1–30 days', value: aging.d1_30 },
    { label: '31–60 days', value: aging.d31_60 },
    { label: '61–90 days', value: aging.d61_90 },
    { label: '90+ days', value: aging.d90plus },
  ]
  return (
    <Card>
      <CardContent className="py-4">
        <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
          Receivables aging (all open invoices)
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {buckets.map((b, i) => (
            <div key={b.label}>
              <p className="text-xs text-muted-foreground">{b.label}</p>
              <p
                className={`text-sm font-semibold tabular-nums ${
                  i >= 3 && b.value > 0 ? 'text-destructive' : ''
                }`}
              >
                ₹{b.value.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function InvoicesIndex({ invoices, customers, filters, aging }: PageProps) {
  const outstanding = invoices
    .filter((i: InvoiceRow) => i.status === 'unpaid' || i.status === 'partial')
    .reduce((s, i) => s + (Number(i.total) - Number(i.paidTotal)), 0)
  const paid = invoices.filter((i) => i.status === 'paid').length
  const totalBilled = invoices.reduce((s, i) => s + Number(i.total || 0), 0)
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Invoices</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total invoices"
          value={invoices.length}
          hint={`Billed ₹${totalBilled.toFixed(2)}`}
          icon={Receipt}
        />
        <StatCard label="Paid" value={paid} icon={CheckCircle2} />
        <StatCard label="Outstanding" value={`₹${outstanding.toFixed(2)}`} icon={Wallet} />
      </div>

      <AgingStrip aging={aging} />

      <ListToolbar
        basePath="/invoices"
        q={filters.q}
        searchPlaceholder="Search by number…"
        selects={[
          {
            name: 'status',
            value: filters.status,
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'unpaid', label: 'Unpaid' },
              { value: 'partial', label: 'Partial' },
              { value: 'paid', label: 'Paid' },
              { value: 'void', label: 'Void' },
            ],
          },
          {
            name: 'customerId',
            value: filters.customerId,
            options: [
              { value: 'all', label: 'All customers' },
              ...customers.map((c) => ({ value: String(c.id), label: c.name })),
            ],
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>All invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No invoices found"
              description="Invoices are created when an order is confirmed. Confirm an order to issue one."
              action={
                <Button asChild variant="outline">
                  <Link href="/orders">Go to orders</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.number}</TableCell>
                    <TableCell>{i.customerName}</TableCell>
                    <TableCell>
                      <StatusBadge kind="invoice" status={i.status} />
                    </TableCell>
                    <TableCell>{i.issuedAt?.slice(0, 10) ?? '—'}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {i.dueAt?.slice(0, 10) ?? '—'}
                        {i.overdueDays > 0 && (
                          <Badge variant="destructive">{i.overdueDays}d overdue</Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{i.total}</TableCell>
                    <TableCell className="text-right">{i.paidTotal}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon" aria-label="Open invoice">
                        <Link href={`/invoices/${i.id}`}>
                          <ExternalLink className="size-4" />
                        </Link>
                      </Button>
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

InvoicesIndex.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
