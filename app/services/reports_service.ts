import { type DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Invoice from '#models/invoice'
import Inventory from '#models/inventory'
import Material from '#models/material'
import Component from '#models/component'
import ProductionJob from '#models/production_job'
import Product from '#models/product'
import { queryDashboardSeries } from '#services/metrics_service'

export type TopProfitProduct = {
  productId: number
  name: string
  revenue: number
  cost: number
  profit: number
  marginPct: number
}

export type ProfitReport = {
  from: string
  to: string
  revenue: number
  /** Cost of goods sold: what the sold units actually cost (from the stock ledger). */
  cogs: number
  grossProfit: number
  /** Net profit: grossProfit minus operating (non-job) expenses. */
  profit: number
  invoiceCount: number
  productionCost: number
  /** Expenses not tied to a job (machine electricity/maintenance, overheads). */
  operatingExpenses: number
  /** All expenses booked in the window, including job-linked ones (already inside COGS). */
  expenses: number
  grossMarginPct: number
  topProfitProducts: TopProfitProduct[]
  profitTrend: { month: string; revenue: number; cost: number; profit: number }[]
}

/**
 * Profit report over [from, to]:
 *  - revenue: non-void invoices issued in the window,
 *  - COGS: outbound 'sale' stock movements (net of 'sale_return'), valued at
 *    the weighted-average cost captured on each movement — i.e. the cost of
 *    the units actually sold, regardless of when they were produced,
 *  - net profit: revenue − COGS − operating expenses (expenses NOT linked to
 *    a job; job-linked expenses are already inside job cost → unit cost → COGS,
 *    so subtracting them again would double-count),
 *  - productionCost of jobs completed in the window is informational only,
 *  - per-product attribution and the monthly Influx trend as before.
 */
export async function buildProfitReport(from: DateTime, to: DateTime): Promise<ProfitReport> {
  const fromSql = from.toSQL()!
  const toSql = to.toSQL()!

  const invoices = await Invoice.query()
    .where('issued_at', '>=', fromSql)
    .where('issued_at', '<=', toSql)
    .whereNot('status', 'void')

  const revenue = invoices.reduce((s, i) => s + Number(i.total), 0)

  const completedJobs = await ProductionJob.query()
    .where('status', 'completed')
    .where('completed_at', '>=', fromSql)
    .where('completed_at', '<=', toSql)
  const productionCost = completedJobs.reduce((s, j) => s + Number(j.totalCost), 0)

  // COGS: sale movements are negative qty, returns positive, so -SUM(qty*cost)
  // nets them in one pass.
  const cogsRows = await db
    .from('stock_movements')
    .whereIn('reason', ['sale', 'sale_return'])
    .whereBetween('created_at', [fromSql, toSql])
    .select(db.raw('COALESCE(-SUM(qty * unit_cost), 0) as v'))
  const cogs = Number(cogsRows?.[0]?.v ?? 0)

  // Expenses booked in the window: all of them (informational) and the
  // operating slice (not tied to a job) that reduces net profit.
  const [expenseRows, operatingExpenseRows] = await Promise.all([
    db.from('expenses').whereBetween('incurred_at', [fromSql, toSql]).sum('amount as v'),
    db
      .from('expenses')
      .whereNull('job_id')
      .whereBetween('incurred_at', [fromSql, toSql])
      .sum('amount as v'),
  ])
  const expenses = Number(expenseRows?.[0]?.v ?? 0)
  const operatingExpenses = Number(operatingExpenseRows?.[0]?.v ?? 0)

  // Per-product revenue (confirmed sale_items) and COGS (sale movements).
  const [revByProduct, costByProduct, products] = await Promise.all([
    db
      .from('sale_items as si')
      .join('sales as s', 's.id', 'si.sale_id')
      .where('s.status', 'confirmed')
      .whereBetween('s.confirmed_at', [fromSql, toSql])
      .groupBy('si.product_id')
      .select('si.product_id as productId')
      .sum('si.line_total as revenue'),
    db
      .from('stock_movements')
      .where('item_kind', 'product')
      .whereIn('reason', ['sale', 'sale_return'])
      .whereBetween('created_at', [fromSql, toSql])
      .groupBy('item_id')
      .select('item_id as productId')
      .select(db.raw('COALESCE(-SUM(qty * unit_cost), 0) as cost')),
    Product.query(),
  ])

  const pById = new Map(products.map((p) => [p.id, p]))
  const profitMap = new Map<number, TopProfitProduct>()
  const ensure = (id: number): TopProfitProduct => {
    let row = profitMap.get(id)
    if (!row) {
      row = {
        productId: id,
        name: pById.get(id)?.name ?? '—',
        revenue: 0,
        cost: 0,
        profit: 0,
        marginPct: 0,
      }
      profitMap.set(id, row)
    }
    return row
  }
  for (const r of revByProduct as any[]) {
    if (r.productId === null) continue
    ensure(Number(r.productId)).revenue = Number(r.revenue)
  }
  for (const r of costByProduct as any[]) {
    if (r.productId === null) continue
    ensure(Number(r.productId)).cost = Number(r.cost)
  }
  const topProfitProducts = [...profitMap.values()]
    .map((r) => ({
      ...r,
      revenue: round2(r.revenue),
      cost: round2(r.cost),
      profit: round2(r.revenue - r.cost),
      marginPct: r.revenue > 0 ? round2(((r.revenue - r.cost) / r.revenue) * 100) : 0,
    }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10)

  const series = await queryDashboardSeries(from, to)

  const grossProfit = revenue - cogs
  return {
    from: from.toISO()!,
    to: to.toISO()!,
    revenue: round2(revenue),
    cogs: round2(cogs),
    grossProfit: round2(grossProfit),
    profit: round2(grossProfit - operatingExpenses),
    invoiceCount: invoices.length,
    productionCost: round2(productionCost),
    operatingExpenses: round2(operatingExpenses),
    expenses: round2(expenses),
    grossMarginPct: revenue > 0 ? round2((grossProfit / revenue) * 100) : 0,
    topProfitProducts,
    profitTrend: series.profitTrend,
  }
}

export type StockMovementPoint = {
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

export type InventoryReport = {
  totalValuation: number
  lowStock: Array<{
    itemKind: string
    itemId: number
    sku: string
    name: string
    qty: string
    threshold: string | null
  }>
  byKind: { material: number; component: number }
  movements: StockMovementPoint[]
}

export async function buildInventoryReport(): Promise<InventoryReport> {
  const [inventory, materials, components] = await Promise.all([
    Inventory.query(),
    Material.query(),
    Component.query(),
  ])
  const matById = new Map(materials.map((m) => [m.id, m]))
  const compById = new Map(components.map((c) => [c.id, c]))

  let total = 0
  let matVal = 0
  let compVal = 0
  const lowStock: InventoryReport['lowStock'] = []

  for (const inv of inventory) {
    const valuation = Number(inv.qty) * Number(inv.avgUnitCost)
    total += valuation
    if (inv.itemKind === 'material') {
      matVal += valuation
      const m = matById.get(inv.itemId)
      if (m && m.reorderThresholdG !== null && Number(inv.qty) < Number(m.reorderThresholdG)) {
        lowStock.push({
          itemKind: 'material',
          itemId: m.id,
          sku: m.sku,
          name: m.name,
          qty: inv.qty,
          threshold: m.reorderThresholdG,
        })
      }
    } else if (inv.itemKind === 'component') {
      compVal += valuation
      const c = compById.get(inv.itemId)
      if (c && c.reorderThresholdQty !== null && Number(inv.qty) < c.reorderThresholdQty) {
        lowStock.push({
          itemKind: 'component',
          itemId: c.id,
          sku: c.sku,
          name: c.name,
          qty: inv.qty,
          threshold: String(c.reorderThresholdQty),
        })
      }
    }
  }

  // Largest-magnitude stock movements (in and out), for the scatter plot.
  const movementRows = await db
    .from('stock_movements')
    .select(
      'item_kind as itemKind',
      'item_id as itemId',
      'qty',
      'reason',
      'created_at as createdAt'
    )
    .orderByRaw('ABS(qty) DESC')
    .limit(200)

  const movements: StockMovementPoint[] = movementRows.map((r: any) => {
    const qty = Number(r.qty)
    const item =
      r.itemKind === 'material' ? matById.get(Number(r.itemId)) : compById.get(Number(r.itemId))
    const created = r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)
    return {
      ts: created.getTime(),
      date: created.toISOString(),
      qty: round4(qty),
      absQty: round4(Math.abs(qty)),
      direction: qty >= 0 ? 'in' : 'out',
      itemKind: r.itemKind,
      itemId: Number(r.itemId),
      name: item?.name ?? `${r.itemKind} #${r.itemId}`,
      reason: r.reason,
    }
  })

  return {
    totalValuation: round2(total),
    lowStock,
    byKind: { material: round2(matVal), component: round2(compVal) },
    movements,
  }
}

export type JobsReportRow = {
  productId: number
  productName: string
  jobsCompleted: number
  totalProduced: number
  totalCost: number
  avgUnitCost: number
}

/** Cost-per-product across all completed jobs in [from, to]. */
export async function buildJobsReport(from: DateTime, to: DateTime): Promise<JobsReportRow[]> {
  const jobs = await ProductionJob.query()
    .where('status', 'completed')
    .where('completed_at', '>=', from.toSQL()!)
    .where('completed_at', '<=', to.toSQL()!)
  const products = await Product.query()
  const pById = new Map(products.map((p) => [p.id, p]))

  const byProduct = new Map<number, JobsReportRow>()
  for (const j of jobs) {
    const row = byProduct.get(j.productId) ?? {
      productId: j.productId,
      productName: pById.get(j.productId)?.name ?? '—',
      jobsCompleted: 0,
      totalProduced: 0,
      totalCost: 0,
      avgUnitCost: 0,
    }
    row.jobsCompleted += 1
    row.totalProduced += j.producedQty
    row.totalCost += Number(j.totalCost)
    byProduct.set(j.productId, row)
  }
  for (const r of byProduct.values()) {
    r.totalCost = round2(r.totalCost)
    r.avgUnitCost = r.totalProduced > 0 ? round4(r.totalCost / r.totalProduced) : 0
  }
  return [...byProduct.values()].sort((a, b) => b.totalCost - a.totalCost)
}

/**
 * Replays stock_movements and asserts they sum to inventory.qty per item.
 * Used by the nightly `node ace inventory:reconcile` command.
 */
export async function reconcileInventory(): Promise<{
  ok: boolean
  divergent: Array<{
    itemKind: string
    itemId: number
    onHand: number
    sumOfMovements: number
    diff: number
  }>
}> {
  const result = await db
    .from('stock_movements')
    .select('item_kind as itemKind', 'item_id as itemId')
    .sum('qty as sumQty')
    .groupBy('item_kind', 'item_id')

  const inventory = await Inventory.query()
  const invByKey = new Map<string, number>(
    inventory.map((i) => [`${i.itemKind}:${i.itemId}`, Number(i.qty)])
  )

  const movementByKey = new Map<string, number>()
  for (const r of result as Array<{ itemKind: string; itemId: number; sumQty: string }>) {
    movementByKey.set(`${r.itemKind}:${r.itemId}`, Number(r.sumQty))
  }

  const divergent: Awaited<ReturnType<typeof reconcileInventory>>['divergent'] = []

  // Iterate every key in either map so missing inventory rows are caught too.
  const keys = new Set([...invByKey.keys(), ...movementByKey.keys()])
  for (const key of keys) {
    const onHand = invByKey.get(key) ?? 0
    const sum = movementByKey.get(key) ?? 0
    const diff = round4(onHand - sum)
    if (Math.abs(diff) > 0.0005) {
      const [kind, idStr] = key.split(':')
      divergent.push({
        itemKind: kind,
        itemId: Number(idStr),
        onHand: round4(onHand),
        sumOfMovements: round4(sum),
        diff,
      })
    }
  }
  return { ok: divergent.length === 0, divergent }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
