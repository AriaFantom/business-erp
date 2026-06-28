import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { Point } from '@influxdata/influxdb-client'
import { getWriteApi, getBucket, queryRows, isInfluxEnabled } from '#services/influx_service'

/**
 * Time-series metrics pipeline.
 *
 * `computeDailyMetrics` rolls one calendar day of Postgres data into the
 * values we care about; `writeDailySnapshot`/`snapshotRange` persist them as
 * InfluxDB points (the daily Job); `queryDashboardSeries` reads them back for
 * the dashboard and profit report. Everything no-ops when Influx is disabled.
 *
 * Daily totals are bucketed by the business confirmation timestamp:
 *   - sales/purchases → confirmed_at (status = 'confirmed')
 *   - invoices        → issued_at   (status != 'void')
 *   - completed jobs  → completed_at (status = 'completed')
 *   - expenses        → incurred_at
 */

export type DailyMetrics = {
  salesTotal: number
  purchaseTotal: number
  revenue: number
  cost: number
  profit: number
  expensesByKind: { kind: string; amount: number }[]
  customerSales: { customerId: number; name: string; total: number }[]
  productSales: { productId: number; sku: string; name: string; qty: number; revenue: number }[]
  inventoryByKind: { kind: string; valuation: number }[]
}

export type DashboardSeries = {
  salesVsPurchase: { month: string; sales: number; purchase: number }[]
  expensesBySector: { kind: string; amount: number }[]
  profitTrend: { month: string; revenue: number; cost: number; profit: number }[]
  topCustomers: { customerId: number; name: string; total: number }[]
  topProducts: { productId: number; sku: string; name: string; qty: number; revenue: number }[]
}

function sumOf(rows: any[], key = 'v'): number {
  return Number(rows?.[0]?.[key] ?? 0)
}

export async function computeDailyMetrics(day: DateTime): Promise<DailyMetrics> {
  const start = day.startOf('day').toSQL()!
  const end = day.endOf('day').toSQL()!

  const [
    salesRows,
    purchaseRows,
    revenueRows,
    costRows,
    expenseRows,
    customerRows,
    productRows,
    inventoryRows,
  ] = await Promise.all([
    db
      .from('sales')
      .where('status', 'confirmed')
      .whereBetween('confirmed_at', [start, end])
      .sum('total as v'),
    db
      .from('purchases')
      .where('status', 'confirmed')
      .whereBetween('confirmed_at', [start, end])
      .sum('total as v'),
    db
      .from('invoices')
      .whereNot('status', 'void')
      .whereBetween('issued_at', [start, end])
      .sum('total as v'),
    db
      .from('production_jobs')
      .where('status', 'completed')
      .whereBetween('completed_at', [start, end])
      .sum('total_cost as v'),
    db
      .from('expenses')
      .whereBetween('incurred_at', [start, end])
      .groupBy('kind')
      .select('kind')
      .sum('amount as v'),
    db
      .from('sales as s')
      .join('customers as c', 'c.id', 's.customer_id')
      .where('s.status', 'confirmed')
      .whereBetween('s.confirmed_at', [start, end])
      .groupBy('s.customer_id', 'c.name')
      .select('s.customer_id as customerId', 'c.name as name')
      .sum('s.total as v'),
    db
      .from('sale_items as si')
      .join('sales as s', 's.id', 'si.sale_id')
      .join('products as p', 'p.id', 'si.product_id')
      .where('s.status', 'confirmed')
      .whereBetween('s.confirmed_at', [start, end])
      .groupBy('si.product_id', 'p.sku', 'p.name')
      .select('si.product_id as productId', 'p.sku as sku', 'p.name as name')
      .sum('si.qty as qty')
      .sum('si.line_total as revenue'),
    db
      .from('inventory')
      .groupBy('item_kind')
      .select('item_kind as kind')
      .select(db.raw('SUM(qty * avg_unit_cost) as v')),
  ])

  const revenue = sumOf(revenueRows)
  const cost = sumOf(costRows)

  return {
    salesTotal: sumOf(salesRows),
    purchaseTotal: sumOf(purchaseRows),
    revenue,
    cost,
    profit: revenue - cost,
    expensesByKind: expenseRows.map((r: any) => ({ kind: r.kind, amount: Number(r.v) })),
    customerSales: customerRows.map((r: any) => ({
      customerId: Number(r.customerId),
      name: r.name,
      total: Number(r.v),
    })),
    productSales: productRows.map((r: any) => ({
      productId: Number(r.productId),
      sku: r.sku,
      name: r.name,
      qty: Number(r.qty),
      revenue: Number(r.revenue),
    })),
    inventoryByKind: inventoryRows.map((r: any) => ({ kind: r.kind, valuation: Number(r.v) })),
  }
}

/**
 * Write one day's metrics as InfluxDB points. Inventory valuation is a
 * point-in-time snapshot (the inventory table only holds current state), so
 * we only record it for "today" — backfilling past days would write today's
 * valuation onto historical dates, which would be misleading.
 */
export async function writeDailySnapshot(
  day: DateTime,
  opts: { writeApi?: ReturnType<typeof getWriteApi> } = {}
): Promise<boolean> {
  const writeApi = opts.writeApi ?? getWriteApi()
  if (!writeApi) return false

  const m = await computeDailyMetrics(day)
  const ts = day.startOf('day').toJSDate()
  const isToday = day.hasSame(DateTime.now(), 'day')
  const points: Point[] = []

  points.push(new Point('sales').floatField('total', m.salesTotal).timestamp(ts))
  points.push(new Point('purchases').floatField('total', m.purchaseTotal).timestamp(ts))
  points.push(
    new Point('profit')
      .floatField('revenue', m.revenue)
      .floatField('cost', m.cost)
      .floatField('profit', m.profit)
      .timestamp(ts)
  )
  for (const e of m.expensesByKind) {
    points.push(
      new Point('expenses').tag('kind', e.kind).floatField('amount', e.amount).timestamp(ts)
    )
  }
  for (const c of m.customerSales) {
    points.push(
      new Point('customer_sales')
        .tag('customer_id', String(c.customerId))
        .tag('name', c.name)
        .floatField('total', c.total)
        .timestamp(ts)
    )
  }
  for (const p of m.productSales) {
    points.push(
      new Point('product_sales')
        .tag('product_id', String(p.productId))
        .tag('sku', p.sku)
        .tag('name', p.name)
        .floatField('qty', p.qty)
        .floatField('revenue', p.revenue)
        .timestamp(ts)
    )
  }
  if (isToday) {
    for (const i of m.inventoryByKind) {
      points.push(
        new Point('inventory')
          .tag('kind', i.kind)
          .floatField('valuation', i.valuation)
          .timestamp(ts)
      )
    }
  }

  writeApi.writePoints(points)
  if (!opts.writeApi) {
    await writeApi.flush()
    await writeApi.close()
  }
  return true
}

/** Snapshot every day in [from, to] inclusive using a single write batch. */
export async function snapshotRange(from: DateTime, to: DateTime): Promise<number> {
  const writeApi = getWriteApi()
  if (!writeApi) return 0
  let count = 0
  try {
    let day = from.startOf('day')
    const last = to.startOf('day')
    while (day <= last) {
      await writeDailySnapshot(day, { writeApi })
      count++
      day = day.plus({ days: 1 })
    }
    await writeApi.flush()
  } finally {
    await writeApi.close()
  }
  logger.info({ count, from: from.toISODate(), to: to.toISODate() }, 'metrics snapshot written')
  return count
}

function fluxRange(from: DateTime, to: DateTime): { start: string; stop: string } {
  return { start: from.toUTC().toISO()!, stop: to.toUTC().toISO()! }
}

function monthKey(time: string): string {
  return DateTime.fromISO(time).toUTC().toFormat('yyyy-LL')
}

/**
 * Read the dashboard/profit-trend series back out of InfluxDB for the given
 * window. Returns empty arrays when Influx is disabled or on any query error
 * (the charts then render empty states). Top-N is aggregated across the whole
 * window so it reflects the selected range, not a single day.
 */
export async function queryDashboardSeries(from: DateTime, to: DateTime): Promise<DashboardSeries> {
  const empty: DashboardSeries = {
    salesVsPurchase: [],
    expensesBySector: [],
    profitTrend: [],
    topCustomers: [],
    topProducts: [],
  }
  if (!isInfluxEnabled()) return empty

  const bucket = getBucket()
  const { start, stop } = fluxRange(from, to)

  const [salesRows, purchaseRows, expenseRows, profitRows, customerRows, productRows] =
    await Promise.all([
      queryRows(
        `from(bucket:"${bucket}") |> range(start: ${start}, stop: ${stop}) |> filter(fn:(r)=> r._measurement=="sales" and r._field=="total") |> aggregateWindow(every:1mo, fn:sum, createEmpty:false)`
      ),
      queryRows(
        `from(bucket:"${bucket}") |> range(start: ${start}, stop: ${stop}) |> filter(fn:(r)=> r._measurement=="purchases" and r._field=="total") |> aggregateWindow(every:1mo, fn:sum, createEmpty:false)`
      ),
      queryRows(
        `from(bucket:"${bucket}") |> range(start: ${start}, stop: ${stop}) |> filter(fn:(r)=> r._measurement=="expenses" and r._field=="amount") |> group(columns:["kind"]) |> sum() |> group() |> sort(columns:["_value"], desc:true)`
      ),
      queryRows(
        `from(bucket:"${bucket}") |> range(start: ${start}, stop: ${stop}) |> filter(fn:(r)=> r._measurement=="profit") |> aggregateWindow(every:1mo, fn:sum, createEmpty:false) |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value")`
      ),
      queryRows(
        `from(bucket:"${bucket}") |> range(start: ${start}, stop: ${stop}) |> filter(fn:(r)=> r._measurement=="customer_sales" and r._field=="total") |> group(columns:["customer_id","name"]) |> sum() |> group() |> sort(columns:["_value"], desc:true) |> limit(n:8)`
      ),
      queryRows(
        `from(bucket:"${bucket}") |> range(start: ${start}, stop: ${stop}) |> filter(fn:(r)=> r._measurement=="product_sales" and (r._field=="qty" or r._field=="revenue")) |> group(columns:["product_id","sku","name","_field"]) |> sum() |> pivot(rowKey:["product_id","sku","name"], columnKey:["_field"], valueColumn:"_value") |> group() |> sort(columns:["qty"], desc:true) |> limit(n:8)`
      ),
    ])

  // Merge sales + purchase monthly buckets by month key.
  const byMonth = new Map<string, { month: string; sales: number; purchase: number }>()
  for (const r of salesRows) {
    const k = monthKey(r._time)
    const row = byMonth.get(k) ?? { month: k, sales: 0, purchase: 0 }
    row.sales += Number(r._value ?? 0)
    byMonth.set(k, row)
  }
  for (const r of purchaseRows) {
    const k = monthKey(r._time)
    const row = byMonth.get(k) ?? { month: k, sales: 0, purchase: 0 }
    row.purchase += Number(r._value ?? 0)
    byMonth.set(k, row)
  }

  return {
    salesVsPurchase: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)),
    expensesBySector: expenseRows.map((r) => ({ kind: r.kind, amount: Number(r._value ?? 0) })),
    profitTrend: profitRows
      .map((r) => ({
        month: monthKey(r._time),
        revenue: Number(r.revenue ?? 0),
        cost: Number(r.cost ?? 0),
        profit: Number(r.profit ?? 0),
      }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    topCustomers: customerRows.map((r) => ({
      customerId: Number(r.customer_id),
      name: r.name,
      total: Number(r._value ?? 0),
    })),
    topProducts: productRows.map((r) => ({
      productId: Number(r.product_id),
      sku: r.sku,
      name: r.name,
      qty: Number(r.qty ?? 0),
      revenue: Number(r.revenue ?? 0),
    })),
  }
}
