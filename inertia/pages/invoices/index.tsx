import { type ReactElement } from 'react'
import { Link } from '@inertiajs/react'
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
import DashboardLayout from '@/layouts/dashboard-layout'

type InvoiceRow = {
  id: number
  number: string
  saleId: number
  customerId: number
  customerName: string
  status: string
  issuedAt: string | null
  dueAt: string | null
  total: string
  paidTotal: string
}

type PageProps = { invoices: InvoiceRow[] }

function statusVariant(s: string) {
  if (s === 'paid') return 'default' as const
  if (s === 'void') return 'secondary' as const
  if (s === 'partial') return 'outline' as const
  return 'destructive' as const
}

export default function InvoicesIndex({ invoices }: PageProps) {
  const outstanding = invoices
    .filter((i: InvoiceRow) => i.status === 'unpaid' || i.status === 'partial')
    .reduce((s, i) => s + (Number(i.total) - Number(i.paidTotal)), 0)
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          {invoices.length} invoices · ₹{outstanding.toFixed(2)} outstanding.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
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
                      <Badge variant={statusVariant(i.status)}>{i.status}</Badge>
                    </TableCell>
                    <TableCell>{i.issuedAt?.slice(0, 10) ?? '—'}</TableCell>
                    <TableCell>{i.dueAt?.slice(0, 10) ?? '—'}</TableCell>
                    <TableCell className="text-right">{i.total}</TableCell>
                    <TableCell className="text-right">{i.paidTotal}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/invoices/${i.id}`}
                        className="text-sm underline-offset-2 hover:underline"
                      >
                        Open
                      </Link>
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
