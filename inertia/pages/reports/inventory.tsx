import { type ReactElement } from 'react'
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  type ChartConfig,
} from '@/components/ui/chart'
import DashboardLayout from '@/layouts/dashboard-layout'

type StockMovementPoint = {
  ts: number
  date: string
  qty: number
  absQty: number
  direction: 'in' | 'out'
  itemKind: string
  itemId: number
  name: string
  reason: string
}

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
  movements: StockMovementPoint[]
}

type PageProps = { report: Report }

const movementConfig = {
  in: { label: 'Inbound', color: '#059669' },
  out: { label: 'Outbound', color: '#e11d48' },
} satisfies ChartConfig

function MovementTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as StockMovementPoint
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{p.name}</div>
      <div className="text-muted-foreground">
        {new Date(p.ts).toLocaleString()} · {p.reason}
      </div>
      <div className="font-mono">
        {p.qty > 0 ? '+' : ''}
        {p.qty} ({p.direction})
      </div>
    </div>
  )
}

export default function InventoryReport({ report }: PageProps) {
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
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
            <dd className="text-right font-medium">₹{report.totalValuation.toFixed(2)}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock movements ({report.movements.length})</CardTitle>
          <p className="text-sm text-muted-foreground">
            Largest inbound and outbound movements over time — highest data points stand out by
            magnitude.
          </p>
        </CardHeader>
        <CardContent>
          {report.movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock movements recorded yet.</p>
          ) : (
            <ChartContainer config={movementConfig} className="!aspect-auto h-[320px] w-full">
              <ScatterChart margin={{ left: 8, right: 12, top: 8, bottom: 8 }}>
                <CartesianGrid />
                <XAxis
                  type="number"
                  dataKey="ts"
                  name="Time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(v) => new Date(v).toLocaleDateString()}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="qty"
                  name="Qty"
                  tickLine={false}
                  axisLine={false}
                  width={56}
                />
                <ZAxis type="number" dataKey="absQty" range={[40, 400]} name="Magnitude" />
                <ChartTooltip cursor={{ strokeDasharray: '3 3' }} content={<MovementTooltip />} />
                <ChartLegend content={<ChartLegendContent nameKey="direction" />} />
                <Scatter
                  name="in"
                  data={report.movements.filter((m) => m.direction === 'in')}
                  fill="var(--color-in)"
                  fillOpacity={0.7}
                />
                <Scatter
                  name="out"
                  data={report.movements.filter((m) => m.direction === 'out')}
                  fill="var(--color-out)"
                  fillOpacity={0.7}
                />
              </ScatterChart>
            </ChartContainer>
          )}
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
