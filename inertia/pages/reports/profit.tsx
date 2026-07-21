import { type ReactElement, useState } from 'react'
import { router } from '@inertiajs/react'
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from 'recharts'
import { TrendingUp } from 'lucide-react'

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
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import DashboardLayout from '@/layouts/dashboard-layout'

type TopProfitProduct = {
  productId: number
  name: string
  revenue: number
  cost: number
  profit: number
  marginPct: number
}

type Report = {
  from: string
  to: string
  revenue: number
  cogs: number
  grossProfit: number
  profit: number
  invoiceCount: number
  productionCost: number
  operatingExpenses: number
  expenses: number
  grossMarginPct: number
  topProfitProducts: TopProfitProduct[]
  profitTrend: { month: string; revenue: number; cost: number; profit: number }[]
}

type PageProps = { report: Report }

const fmtINR = (n: number) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

function fmtMonth(key: string): string {
  const [y, m] = key.split('-')
  const names = [
    '',
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${names[Number(m)] ?? m} ${y?.slice(2) ?? ''}`
}

export default function ProfitReport({ report }: PageProps) {
  const [from, setFrom] = useState(report.from.slice(0, 10))
  const [to, setTo] = useState(report.to.slice(0, 10))

  const apply = () => {
    router.get('/reports/profit', { from, to }, { preserveState: false, preserveScroll: false })
  }

  const best = report.topProfitProducts[0]
  const trendConfig = {
    profit: { label: 'Profit', color: '#2563eb' },
    revenue: { label: 'Revenue', color: '#059669' },
    cost: { label: 'Cost', color: '#e11d48' },
  } satisfies ChartConfig
  const trendRows = report.profitTrend.map((r) => ({ ...r, label: fmtMonth(r.month) }))

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Profit report</h1>
        <p className="text-sm text-muted-foreground">
          Revenue (non-void invoices) minus cost of goods sold and operating expenses in window.
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

      {best && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Highest-profit product
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">{best.name}</div>
                <div className="text-sm text-muted-foreground">
                  Revenue {fmtINR(best.revenue)} · Cost {fmtINR(best.cost)} · Margin{' '}
                  {best.marginPct.toFixed(1)}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold text-emerald-600">{fmtINR(best.profit)}</div>
                <div className="text-xs text-muted-foreground">profit in window</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
            <dd className="text-right">{fmtINR(report.revenue)}</dd>
            <dt className="text-muted-foreground">Cost of goods sold</dt>
            <dd className="text-right">{fmtINR(report.cogs)}</dd>
            <dt className="text-muted-foreground">Gross profit</dt>
            <dd className="text-right">{fmtINR(report.grossProfit)}</dd>
            <dt className="text-muted-foreground">Gross margin</dt>
            <dd className="text-right">{report.grossMarginPct.toFixed(1)}%</dd>
            <dt className="text-muted-foreground">Operating expenses</dt>
            <dd className="text-right">{fmtINR(report.operatingExpenses)}</dd>
            <dt className="text-muted-foreground">Production cost (jobs completed)</dt>
            <dd className="text-right">{fmtINR(report.productionCost)}</dd>
            <dt className="font-medium">Net profit</dt>
            <dd className="text-right font-medium">{fmtINR(report.profit)}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profit trend</CardTitle>
        </CardHeader>
        <CardContent>
          {trendRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No trend data yet. Run <code>node ace metrics:snapshot --backfill=365</code> to
              populate it.
            </p>
          ) : (
            <ChartContainer config={trendConfig} className="!aspect-auto h-[260px] w-full">
              <AreaChart data={trendRows} margin={{ left: 8, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={(v) => fmtINR(v)}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                />
                <ChartTooltip
                  content={<ChartTooltipContent formatter={(v) => fmtINR(Number(v))} />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <defs>
                  <linearGradient id="fillProfitReport" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-profit)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-profit)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <Area
                  dataKey="profit"
                  type="monotone"
                  stroke="var(--color-profit)"
                  strokeWidth={2}
                  fill="url(#fillProfitReport)"
                />
                <Line
                  dataKey="revenue"
                  type="monotone"
                  stroke="var(--color-revenue)"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  dataKey="cost"
                  type="monotone"
                  stroke="var(--color-cost)"
                  strokeWidth={1.5}
                  dot={false}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profit by product ({report.topProfitProducts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {report.topProfitProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No product sales/production in this window.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.topProfitProducts.map((p) => (
                  <TableRow key={p.productId}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right">{fmtINR(p.revenue)}</TableCell>
                    <TableCell className="text-right">{fmtINR(p.cost)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtINR(p.profit)}</TableCell>
                    <TableCell className="text-right">{p.marginPct.toFixed(1)}%</TableCell>
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

ProfitReport.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
