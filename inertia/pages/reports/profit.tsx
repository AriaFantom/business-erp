import { type ReactElement, useState } from 'react'
import { router } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import DashboardLayout from '@/layouts/dashboard-layout'

type Report = {
  from: string
  to: string
  revenue: number
  cost: number
  profit: number
  invoiceCount: number
  productionCost: number
}

type PageProps = { report: Report }

export default function ProfitReport({ report }: PageProps) {
  const [from, setFrom] = useState(report.from.slice(0, 10))
  const [to, setTo] = useState(report.to.slice(0, 10))

  const apply = () => {
    router.get(
      '/reports/profit',
      { from, to },
      { preserveState: false, preserveScroll: false }
    )
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Profit report</h1>
        <p className="text-sm text-muted-foreground">
          Revenue (non-void invoices) minus production cost (completed jobs) in window.
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
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button onClick={apply}>Apply</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Result</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Window</dt>
            <dd className="text-right font-mono text-xs">
              {report.from.slice(0, 10)} → {report.to.slice(0, 10)}
            </dd>
            <dt className="text-muted-foreground">Invoices</dt>
            <dd className="text-right">{report.invoiceCount}</dd>
            <dt className="text-muted-foreground">Revenue</dt>
            <dd className="text-right">₹{report.revenue.toFixed(2)}</dd>
            <dt className="text-muted-foreground">Production cost</dt>
            <dd className="text-right">₹{report.productionCost.toFixed(2)}</dd>
            <dt className="font-medium">Profit</dt>
            <dd className="text-right font-medium">₹{report.profit.toFixed(2)}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}

ProfitReport.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
