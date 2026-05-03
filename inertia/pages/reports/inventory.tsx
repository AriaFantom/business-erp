import { type ReactElement } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import DashboardLayout from '@/layouts/dashboard-layout'

type Report = {
  totalValuation: number
  byKind: { material: number; component: number }
  lowStock: Array<{
    itemKind: string
    itemId: number
    sku: string
    name: string
    qty: string
    threshold: string | null
  }>
}

type PageProps = { report: Report }

export default function InventoryReport({ report }: PageProps) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Inventory report</h1>
        <p className="text-sm text-muted-foreground">
          Stock valuation and items below their reorder threshold.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Valuation</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Materials</dt>
            <dd className="text-right">₹{report.byKind.material.toFixed(2)}</dd>
            <dt className="text-muted-foreground">Components</dt>
            <dd className="text-right">₹{report.byKind.component.toFixed(2)}</dd>
            <dt className="font-medium">Total</dt>
            <dd className="text-right font-medium">
              ₹{report.totalValuation.toFixed(2)}
            </dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Low stock ({report.lowStock.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {report.lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing below threshold.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kind</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">Threshold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.lowStock.map((r) => (
                  <TableRow key={`${r.itemKind}:${r.itemId}`}>
                    <TableCell>{r.itemKind}</TableCell>
                    <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">{r.qty}</TableCell>
                    <TableCell className="text-right">{r.threshold ?? '—'}</TableCell>
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

InventoryReport.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
