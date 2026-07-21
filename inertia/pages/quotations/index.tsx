import { type ReactElement } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { CheckCircle2, ExternalLink, FileText, Send, Plus } from 'lucide-react'
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
import { ColumnVisibilityMenu, type ColumnDef } from '@/components/data-table/column-visibility'
import { useColumnVisibility } from '@/hooks/use-column-visibility'

type QuotationRow = {
  id: number
  number: string
  customerId: number
  customerName: string
  status: string
  issuedAt: string | null
  validUntil: string | null
  total: string
}

type CustomerOpt = { id: number; name: string }

type Filters = { q: string; status: string; customerId: string }

type PageProps = {
  quotations: QuotationRow[]
  customers: CustomerOpt[]
  filters: Filters
}

const QUOTATION_COLUMNS: ColumnDef[] = [
  { key: 'number', label: 'Number', required: true },
  { key: 'customer', label: 'Customer' },
  { key: 'status', label: 'Status' },
  { key: 'issued', label: 'Issued' },
  { key: 'validUntil', label: 'Valid until' },
  { key: 'total', label: 'Total' },
  { key: 'actions', label: 'Actions', required: true },
]

export default function QuotationsIndex({ quotations, customers, filters }: PageProps) {
  const { isVisible, toggle, reset } = useColumnVisibility('quotations')
  const totalValue = quotations.reduce((s, q) => s + Number(q.total || 0), 0)
  const accepted = quotations.filter(
    (q) => q.status === 'accepted' || q.status === 'converted'
  ).length
  const draftSent = quotations.filter((q) => q.status === 'draft' || q.status === 'sent').length
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Quotations</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/quotations/new">
              <Plus className="mr-1 size-4" /> New quotation
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total quotations" value={quotations.length} icon={FileText} />
        <StatCard label="In flight" value={draftSent} hint="Draft or sent" icon={Send} />
        <StatCard
          label="Accepted / converted"
          value={accepted}
          hint={`Pipeline value ₹${totalValue.toFixed(2)}`}
          icon={CheckCircle2}
        />
      </div>

      <ListToolbar
        basePath="/quotations"
        q={filters.q}
        searchPlaceholder="Search by number…"
        selects={[
          {
            name: 'status',
            value: filters.status,
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'sent', label: 'Sent' },
              { value: 'accepted', label: 'Accepted' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'expired', label: 'Expired' },
              { value: 'converted', label: 'Converted' },
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
          <CardTitle>All quotations</CardTitle>
        </CardHeader>
        <CardContent>
          {quotations.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No quotations yet"
              description="Draft a quotation for a customer to begin the sales flow."
              action={
                <Button asChild>
                  <Link href="/quotations/new">
                    <Plus className="mr-1 size-4" /> New quotation
                  </Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isVisible('number') && <TableHead>Number</TableHead>}
                  {isVisible('customer') && <TableHead>Customer</TableHead>}
                  {isVisible('status') && <TableHead>Status</TableHead>}
                  {isVisible('issued') && <TableHead>Issued</TableHead>}
                  {isVisible('validUntil') && <TableHead>Valid until</TableHead>}
                  {isVisible('total') && <TableHead className="text-right">Total</TableHead>}
                  {isVisible('actions') && (
                    <TableHead className="w-20 text-right">
                      <ColumnVisibilityMenu
                        columns={QUOTATION_COLUMNS}
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
                {quotations.map((q) => (
                  <TableRow key={q.id}>
                    {isVisible('number') && (
                      <TableCell className="font-mono text-xs">{q.number}</TableCell>
                    )}
                    {isVisible('customer') && <TableCell>{q.customerName}</TableCell>}
                    {isVisible('status') && (
                      <TableCell>
                        <StatusBadge kind="quotation" status={q.status} />
                      </TableCell>
                    )}
                    {isVisible('issued') && (
                      <TableCell>{q.issuedAt?.slice(0, 10) ?? '—'}</TableCell>
                    )}
                    {isVisible('validUntil') && (
                      <TableCell>{q.validUntil?.slice(0, 10) ?? '—'}</TableCell>
                    )}
                    {isVisible('total') && <TableCell className="text-right">{q.total}</TableCell>}
                    {isVisible('actions') && (
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="icon" aria-label="Open quotation">
                          <Link href={`/quotations/${q.id}`}>
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

QuotationsIndex.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
