import { type ReactElement, useState } from 'react'
import { router } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

type Row = {
  productId: number
  productName: string
  jobsCompleted: number
  totalProduced: number
  totalCost: number
  avgUnitCost: number
}

type PageProps = { rows: Row[]; from: string; to: string }

export default function JobsReport({ rows, from, to }: PageProps) {
  const [fromDate, setFromDate] = useState(from.slice(0, 10))
  const [toDate, setToDate] = useState(to.slice(0, 10))

  const apply = () => {
    router.get(
      '/reports/jobs',
      { from: fromDate, to: toDate },
      { preserveState: false, preserveScroll: false }
    )
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Jobs report</h1>
        <p className="text-sm text-muted-foreground">
          Cost and unit economics per product across completed jobs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label>From</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>To</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <Button onClick={apply}>Apply</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By product</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No completed jobs in this window.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Jobs</TableHead>
                  <TableHead className="text-right">Produced</TableHead>
                  <TableHead className="text-right">Total cost</TableHead>
                  <TableHead className="text-right">Avg unit cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.productId}>
                    <TableCell className="font-medium">{r.productName}</TableCell>
                    <TableCell className="text-right">{r.jobsCompleted}</TableCell>
                    <TableCell className="text-right">{r.totalProduced}</TableCell>
                    <TableCell className="text-right">
                      ₹{r.totalCost.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      ₹{r.avgUnitCost.toFixed(4)}
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

JobsReport.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
