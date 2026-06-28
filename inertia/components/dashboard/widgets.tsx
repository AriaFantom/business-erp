import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity } from 'lucide-react'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

export type DashboardData = {
  salesVsPurchase: { month: string; sales: number; purchase: number }[]
  expensesBySector: { kind: string; amount: number }[]
  profitTrend: { month: string; revenue: number; cost: number; profit: number }[]
  topCustomers: { customerId: number; name: string; total: number }[]
  topProducts: { productId: number; sku: string; name: string; qty: number; revenue: number }[]
  activeMachines: {
    id: number
    name: string
    jobNumber: string | null
    productName: string | null
    stage: string | null
  }[]
  machineStatusCounts: { status: string; count: number }[]
}

const PALETTE = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#e11d48',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#475569',
]

const CHART_H = '!aspect-auto h-[240px] w-full'

function fmtINR(n: number): string {
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function fmtMonth(key: string): string {
  // key is "yyyy-LL"
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
  return `${names[Number(m)] ?? m} ${y.slice(2)}`
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

export function TopCustomersWidget({ data }: { data: DashboardData }) {
  if (!data.topCustomers.length) return <Empty label="No customer sales in this range" />
  const config = { total: { label: 'Spend', color: PALETTE[0] } } satisfies ChartConfig
  const rows = data.topCustomers.map((c) => ({ name: c.name, total: c.total }))
  return (
    <ChartContainer config={config} className={CHART_H}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => fmtINR(v)} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtINR(Number(v))} />} />
        <Bar dataKey="total" fill="var(--color-total)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}

export function TopProductsWidget({ data }: { data: DashboardData }) {
  if (!data.topProducts.length) return <Empty label="No products sold in this range" />
  const config = { qty: { label: 'Qty sold', color: PALETTE[1] } } satisfies ChartConfig
  const rows = data.topProducts.map((p) => ({ name: p.name, qty: p.qty, revenue: p.revenue }))
  return (
    <ChartContainer config={config} className={CHART_H}>
      <BarChart data={rows} margin={{ left: 4, right: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10 }}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={56}
        />
        <YAxis tickLine={false} axisLine={false} width={32} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => (
                <div className="flex w-full justify-between gap-3">
                  <span className="text-muted-foreground">{item?.payload?.name}</span>
                  <span className="font-mono">
                    {Number(value).toLocaleString()} · {fmtINR(item?.payload?.revenue ?? 0)}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="qty" fill="var(--color-qty)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}

export function SalesVsPurchaseWidget({ data }: { data: DashboardData }) {
  if (!data.salesVsPurchase.length) return <Empty label="No sales/purchase data in this range" />
  const config = {
    sales: { label: 'Sales', color: PALETTE[1] },
    purchase: { label: 'Purchase', color: PALETTE[3] },
  } satisfies ChartConfig
  const rows = data.salesVsPurchase.map((r) => ({ ...r, label: fmtMonth(r.month) }))
  return (
    <ChartContainer config={config} className={CHART_H}>
      <LineChart data={rows} margin={{ left: 8, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => fmtINR(v)} tickLine={false} axisLine={false} width={56} />
        <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtINR(Number(v))} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line dataKey="sales" stroke="var(--color-sales)" strokeWidth={2} dot={false} />
        <Line dataKey="purchase" stroke="var(--color-purchase)" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  )
}

export function ExpensesBySectorWidget({ data }: { data: DashboardData }) {
  if (!data.expensesBySector.length) return <Empty label="No expenses in this range" />
  const config: ChartConfig = Object.fromEntries(
    data.expensesBySector.map((e, i) => [
      e.kind,
      { label: e.kind, color: PALETTE[i % PALETTE.length] },
    ])
  )
  const rows = data.expensesBySector.map((e, i) => ({
    kind: e.kind,
    amount: e.amount,
    fill: PALETTE[i % PALETTE.length],
  }))
  return (
    <ChartContainer config={config} className={CHART_H}>
      <PieChart>
        <ChartTooltip
          content={<ChartTooltipContent nameKey="kind" formatter={(v) => fmtINR(Number(v))} />}
        />
        <Pie
          data={rows}
          dataKey="amount"
          nameKey="kind"
          innerRadius={48}
          outerRadius={88}
          paddingAngle={2}
        >
          {rows.map((r) => (
            <Cell key={r.kind} fill={r.fill} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="kind" />} />
      </PieChart>
    </ChartContainer>
  )
}

export function ProfitTrendWidget({ data }: { data: DashboardData }) {
  if (!data.profitTrend.length) return <Empty label="No profit data in this range" />
  const config = {
    profit: { label: 'Profit', color: PALETTE[0] },
    revenue: { label: 'Revenue', color: PALETTE[1] },
    cost: { label: 'Cost', color: PALETTE[3] },
  } satisfies ChartConfig
  const rows = data.profitTrend.map((r) => ({ ...r, label: fmtMonth(r.month) }))
  return (
    <ChartContainer config={config} className={CHART_H}>
      <AreaChart data={rows} margin={{ left: 8, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => fmtINR(v)} tickLine={false} axisLine={false} width={56} />
        <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtINR(Number(v))} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <defs>
          <linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-profit)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-profit)" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <Area
          dataKey="profit"
          type="monotone"
          stroke="var(--color-profit)"
          strokeWidth={2}
          fill="url(#fillProfit)"
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
  )
}

export function ActiveMachinesWidget({ data }: { data: DashboardData }) {
  const config: ChartConfig = Object.fromEntries(
    data.machineStatusCounts.map((s, i) => [
      s.status,
      { label: s.status, color: PALETTE[i % PALETTE.length] },
    ])
  )
  const donut = data.machineStatusCounts.map((s, i) => ({
    status: s.status,
    count: s.count,
    fill: PALETTE[i % PALETTE.length],
  }))
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="flex-1">
        {data.activeMachines.length === 0 ? (
          <Empty label="No machines currently printing" />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.activeMachines.map((m) => (
              <li key={m.id} className="flex items-start gap-2 rounded-md border bg-card px-3 py-2">
                <Activity className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{m.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {m.productName ?? '—'}
                    {m.jobNumber ? ` · ${m.jobNumber}` : ''}
                    {m.stage ? ` · ${m.stage}` : ''}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {donut.length > 0 && (
        <div className="sm:w-[44%]">
          <ChartContainer config={config} className="!aspect-auto h-[200px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="status" />} />
              <Pie data={donut} dataKey="count" nameKey="status" innerRadius={40} outerRadius={72}>
                {donut.map((d) => (
                  <Cell key={d.status} fill={d.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="status" />} />
            </PieChart>
          </ChartContainer>
        </div>
      )}
    </div>
  )
}
