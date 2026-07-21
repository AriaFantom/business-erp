import { type ReactElement } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { CheckCircle2, ExternalLink, Plus, ScrollText, XCircle } from 'lucide-react'
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
import { StatusBadge } from '@/components/status-badge'
import { EmptyState } from '@/components/empty-state'
import DashboardLayout from '@/layouts/dashboard-layout'
import { ListToolbar } from '@/components/catalog/list-toolbar'
import { StatCard } from '@/components/catalog/stat-card'
import {
  ColumnVisibilityMenu,
  type ColumnDef,
} from '@/components/data-table/column-visibility'
import { useColumnVisibility } from '@/hooks/use-column-visibility'

type OrderRow = {
  id: number
  number: string
  customerId: number
  customerName: string
  status: string
  total: string
  confirmedAt: string | null
  quotationId: number | null
}

type CustomerOpt = { id: number; name: string }

type Filters = { q: string; status: string; customerId: string }

type PageProps = {
  orders: OrderRow[]
  customers: CustomerOpt[]
  filters: Filters
}

function NewOrderButton() {
  return (
    <Button asChild>
      <Link href="/orders/new">
        <Plus className="size-4" /> New order
      </Link>
    </Button>
  )
}

const ORDER_COLUMNS: ColumnDef[] = [
  { key: 'number', label: 'Number', required: true },
  { key: 'customer', label: 'Customer' },
  { key: 'status', label: 'Status' },
  { key: 'total', label: 'Total' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'actions', label: 'Actions', required: true },
]

export default function OrdersIndex({ orders, customers, filters }: PageProps) {
  const { isVisible, toggle, reset } = useColumnVisibility('orders')
  const confirmedCount = orders.filter((o) => o.status === 'confirmed').length
  const cancelledCount = orders.filter((o) => o.status === 'cancelled').length
  const totalRevenue = orders
    .filter((o) => o.status === 'confirmed')
    .reduce((sum, o) => sum + Number(o.total || 0), 0)
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Orders</h1>
        </div>
        <div className="flex items-center gap-2">
          <NewOrderButton />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total orders" value={orders.length} icon={ScrollText} />
        <StatCard
          label="Confirmed"
          value={confirmedCount}
          hint={`Revenue ₹${totalRevenue.toFixed(2)}`}
          icon={CheckCircle2}
        />
        <StatCard label="Cancelled" value={cancelledCount} icon={XCircle} />
      </div>

      <ListToolbar
        basePath="/orders"
        q={filters.q}
        searchPlaceholder="Search by number…"
        selects={[
          {
            name: 'status',
            value: filters.status,
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'cancelled', label: 'Cancelled' },
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
          <CardTitle>All orders</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No orders yet"
              description="Create an order or convert an accepted quotation to get started."
              action={<NewOrderButton />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isVisible('number') && <TableHead>Number</TableHead>}
                  {isVisible('customer') && <TableHead>Customer</TableHead>}
                  {isVisible('status') && <TableHead>Status</TableHead>}
                  {isVisible('total') && <TableHead className="text-right">Total</TableHead>}
                  {isVisible('confirmed') && <TableHead>Confirmed</TableHead>}
                  {isVisible('actions') && (
                    <TableHead className="w-20 text-right">
                      <ColumnVisibilityMenu
                        columns={ORDER_COLUMNS}
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
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    {isVisible('number') && (
                      <TableCell className="font-mono text-xs">{o.number}</TableCell>
                    )}
                    {isVisible('customer') && <TableCell>{o.customerName}</TableCell>}
                    {isVisible('status') && (
                      <TableCell>
                        <StatusBadge kind="order" status={o.status} />
                      </TableCell>
                    )}
                    {isVisible('total') && (
                      <TableCell className="text-right">{o.total}</TableCell>
                    )}
                    {isVisible('confirmed') && (
                      <TableCell>{o.confirmedAt?.slice(0, 10) ?? '—'}</TableCell>
                    )}
                    {isVisible('actions') && (
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="icon" aria-label="Open order">
                          <Link href={`/orders/${o.id}`}>
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

OrdersIndex.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
