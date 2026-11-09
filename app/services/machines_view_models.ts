import Machine from '#models/machine'
import PurchaseItem from '#models/purchase_item'
import Expense from '#models/expense'
import ProductionJob from '#models/production_job'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Material from '#models/material'
import Component from '#models/component'
import { getDeletionBlockers } from '#services/catalog_deletion_service'

// Mirrors the union the machines pages expect; the schema column is a bare string.
export type MachineStatus = 'idle' | 'running' | 'maintenance' | 'offline' | 'retired'

type IndexFilters = { q?: string; status?: string }

/**
 * Run minutes over the last 30 days, grouped by machine — a single join of
 * production_job_stages to production_jobs (on job_id), summing completed
 * stage durations for jobs pinned to a machine. Force-done jobs use their
 * configured minutes, matching their billed machine cost; ordinary jobs use
 * elapsed stage timestamps. Avoids N+1 per-machine queries.
 */
async function getRunMinutes30dByMachine(): Promise<Map<number, number>> {
  const since = DateTime.now().minus({ days: 30 }).toSQL()
  const rows = await db
    .from('production_job_stages as s')
    .innerJoin('production_jobs as j', 's.job_id', 'j.id')
    .whereNotNull('j.machine_id')
    .where('j.status', 'completed')
    .where('j.completed_at', '>=', since)
    .groupBy('j.machine_id')
    .select('j.machine_id as machineId')
    .select(
      db.raw(
        `COALESCE(SUM(
          CASE
            WHEN j.completion_time_basis = 'forced_configured' THEN s.estimated_duration_min
            WHEN s.started_at IS NOT NULL AND s.completed_at IS NOT NULL
              THEN EXTRACT(EPOCH FROM (s.completed_at - s.started_at)) / 60
            ELSE 0
          END
        ), 0) as minutes`
      )
    )
  const byMachine = new Map<number, number>()
  for (const row of rows) {
    byMachine.set(Number(row.machineId), Math.round(Number(row.minutes)))
  }
  return byMachine
}

/** Machine cost recovered over the last 30 days, grouped by machine. */
async function getMachineCost30dByMachine(): Promise<Map<number, number>> {
  const since = DateTime.now().minus({ days: 30 }).toSQL()
  const rows = await db
    .from('production_jobs')
    .whereNotNull('machine_id')
    .where('completed_at', '>=', since)
    .groupBy('machine_id')
    .select('machine_id')
    .sum({ cost: 'total_machine_cost' })
  const byMachine = new Map<number, number>()
  for (const row of rows) {
    byMachine.set(Number(row.machine_id), Number(row.cost) || 0)
  }
  return byMachine
}

type SalesMetric = {
  soldQty: number
  salesRevenue: number
  productionCost: number
  salesProfit: number
}

async function getSalesMetricsByMachine(ids: number[]): Promise<Map<number, SalesMetric>> {
  if (ids.length === 0) return new Map()
  const rows = await db
    .from('production_outputs as po')
    .innerJoin('order_item_production_allocations as a', 'a.production_output_id', 'po.id')
    .innerJoin('order_items as oi', 'oi.id', 'a.order_item_id')
    .innerJoin('orders as o', 'o.id', 'oi.order_id')
    .leftJoin('invoices as i', 'i.order_id', 'o.id')
    .whereIn('po.machine_id', ids)
    .where('o.status', 'confirmed')
    .groupBy('po.machine_id')
    .select('po.machine_id')
    .select(
      db.raw('COALESCE(SUM(a.qty - a.returned_qty), 0) as sold_qty'),
      db.raw(
        `COALESCE(SUM(CASE WHEN COALESCE(i.status, 'unpaid') <> 'void'
          THEN (a.qty - a.returned_qty) * a.unit_sale_price ELSE 0 END), 0) as sales_revenue`
      ),
      db.raw('COALESCE(SUM((a.qty - a.returned_qty) * a.unit_cost), 0) as production_cost')
    )
  const result = new Map<number, SalesMetric>()
  for (const row of rows) {
    const salesRevenue = Number(row.sales_revenue) || 0
    const productionCost = Number(row.production_cost) || 0
    result.set(Number(row.machine_id), {
      soldQty: Number(row.sold_qty) || 0,
      salesRevenue,
      productionCost,
      salesProfit: salesRevenue - productionCost,
    })
  }
  return result
}

export async function getMachinesIndexViewModel(filters: IndexFilters = {}) {
  const q = (filters.q ?? '').trim()
  const status = filters.status ?? 'all'

  const all = await Machine.query().orderBy('name', 'asc')

  const counts = {
    total: all.length,
    idle: all.filter((m) => m.status === 'idle').length,
    running: all.filter((m) => m.status === 'running').length,
    maintenance: all.filter((m) => m.status === 'maintenance').length,
    offline: all.filter((m) => m.status === 'offline').length,
    retired: all.filter((m) => m.status === 'retired').length,
  }

  const filtered = all.filter((m) => {
    if (status !== 'all' && m.status !== status) return false
    if (q) {
      const hay = `${m.name} ${m.model ?? ''} ${m.serialNumber ?? ''}`.toLowerCase()
      if (!hay.includes(q.toLowerCase())) return false
    }
    return true
  })
  const filteredIds = filtered.map((machine) => machine.id)

  const expenseSums = await db
    .from('expenses')
    .whereNotNull('machine_id')
    .groupBy('machine_id')
    .select('machine_id')
    .sum({ sum: 'amount' })
  const expensesById = new Map<number, number>()
  for (const row of expenseSums) {
    expensesById.set(Number(row.machine_id), Number(row.sum) || 0)
  }

  const itemIds = filtered.map((m) => m.purchaseItemId).filter((x): x is number => !!x)
  const items = itemIds.length ? await PurchaseItem.query().whereIn('id', itemIds) : []
  const itemById = new Map(items.map((i) => [i.id, i]))

  const [runMinutes30dByMachine, machineCost30dByMachine, salesMetrics, deleteBlockers] =
    await Promise.all([
      getRunMinutes30dByMachine(),
      getMachineCost30dByMachine(),
      getSalesMetricsByMachine(filteredIds),
      getDeletionBlockers('machine', filteredIds),
    ])

  return {
    machines: filtered.map((m) => {
      const item = m.purchaseItemId ? itemById.get(m.purchaseItemId) : null
      const purchaseCost = item ? Number(item.landedUnitCost ?? item.unitCost) : null
      const expenseTotal = expensesById.get(m.id) ?? 0
      const sales = salesMetrics.get(m.id) ?? {
        soldQty: 0,
        salesRevenue: 0,
        productionCost: 0,
        salesProfit: 0,
      }
      return {
        id: m.id,
        name: m.name,
        model: m.model,
        serialNumber: m.serialNumber,
        status: m.status as MachineStatus,
        currentJobId: m.currentJobId,
        hourlyRate: m.hourlyRate,
        purchaseCost: purchaseCost === null ? null : String(purchaseCost),
        expenseTotal: String(expenseTotal),
        totalSpent: purchaseCost === null ? null : String(purchaseCost + expenseTotal),
        soldQty: sales.soldQty,
        salesProfit: String(sales.salesProfit),
        deleteBlocker: deleteBlockers.get(m.id) ?? null,
        acquiredAt: m.acquiredAt?.toISO() ?? null,
        runMinutes30d: runMinutes30dByMachine.get(m.id) ?? 0,
        machineCost30d: String(machineCost30dByMachine.get(m.id) ?? 0),
      }
    }),
    filters: { q, status },
    counts,
  }
}

export async function getMachineShowViewModel(id: number) {
  const machine = await Machine.findOrFail(id)
  const [
    jobs,
    expenses,
    item,
    runMinutes30dByMachine,
    machineCost30dByMachine,
    lifetimeRow,
    salesMetrics,
    deleteBlockers,
    usageRows,
  ] = await Promise.all([
    ProductionJob.query().where('machine_id', id).orderBy('started_at', 'desc').limit(50),
    Expense.query().where('machine_id', id).orderBy('incurred_at', 'desc'),
    machine.purchaseItemId ? PurchaseItem.find(machine.purchaseItemId) : null,
    getRunMinutes30dByMachine(),
    getMachineCost30dByMachine(),
    // Lifetime totals aren't bounded by the 50-row job history above.
    db
      .from('production_jobs')
      .where('machine_id', id)
      .select(
        db.raw('COALESCE(SUM(machine_minutes), 0) as minutes'),
        db.raw('COALESCE(SUM(total_machine_cost), 0) as cost')
      )
      .first(),
    getSalesMetricsByMachine([id]),
    getDeletionBlockers('machine', [id]),
    db
      .from('job_material_consumptions as c')
      .innerJoin('production_jobs as j', 'j.id', 'c.job_id')
      .where('j.machine_id', id)
      .groupBy('c.item_kind', 'c.item_id')
      .select('c.item_kind', 'c.item_id')
      .select(
        db.raw('COALESCE(SUM(c.qty_consumed - c.qty_returned), 0) as used_qty'),
        db.raw('COALESCE(SUM(c.qty_wasted), 0) as wasted_qty')
      ),
  ])
  const purchaseCost = item ? Number(item.landedUnitCost ?? item.unitCost) : null
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const standaloneExpenseTotal = expenses
    .filter((expense) => expense.jobId === null)
    .reduce((sum, expense) => sum + Number(expense.amount), 0)
  const sales = salesMetrics.get(id) ?? {
    soldQty: 0,
    salesRevenue: 0,
    productionCost: 0,
    salesProfit: 0,
  }
  const materialIds = usageRows
    .filter((row) => row.item_kind === 'material')
    .map((row) => Number(row.item_id))
  const componentIds = usageRows
    .filter((row) => row.item_kind === 'component')
    .map((row) => Number(row.item_id))
  const [materials, components, acquisition] = await Promise.all([
    materialIds.length ? Material.query().whereIn('id', materialIds) : Promise.resolve([]),
    componentIds.length ? Component.query().whereIn('id', componentIds) : Promise.resolve([]),
    machine.purchaseItemId
      ? db
          .from('purchase_items as pi')
          .innerJoin('purchases as p', 'p.id', 'pi.purchase_id')
          .innerJoin('suppliers as s', 's.id', 'p.supplier_id')
          .where('pi.id', machine.purchaseItemId)
          .select('p.id', 'p.number', 'p.purchased_at', 's.name as supplier_name')
          .first()
      : null,
  ])
  const materialById = new Map(materials.map((material) => [material.id, material]))
  const componentById = new Map(components.map((component) => [component.id, component]))
  return {
    machine: {
      id: machine.id,
      name: machine.name,
      model: machine.model,
      serialNumber: machine.serialNumber,
      status: machine.status as MachineStatus,
      currentJobId: machine.currentJobId,
      notes: machine.notes,
      acquiredAt: machine.acquiredAt?.toISO() ?? null,
      hourlyRate: machine.hourlyRate,
      purchaseCost: purchaseCost === null ? null : String(purchaseCost),
      expenseTotal: String(expenseTotal),
      standaloneExpenseTotal: String(standaloneExpenseTotal),
      totalSpent: purchaseCost === null ? null : String(purchaseCost + expenseTotal),
      soldQty: sales.soldQty,
      salesRevenue: String(sales.salesRevenue),
      productionCost: String(sales.productionCost),
      salesProfit: String(sales.salesProfit),
      afterPurchaseAndExpenses:
        purchaseCost === null
          ? null
          : String(sales.salesProfit - purchaseCost - standaloneExpenseTotal),
      deleteBlocker: deleteBlockers.get(id) ?? null,
      runMinutes30d: runMinutes30dByMachine.get(machine.id) ?? 0,
      machineCost30d: String(machineCost30dByMachine.get(machine.id) ?? 0),
      lifetimeMachineMinutes: Math.round(Number(lifetimeRow?.minutes ?? 0)),
      lifetimeMachineCost: String(Number(lifetimeRow?.cost ?? 0)),
    },
    acquisition: acquisition
      ? {
          purchaseId: Number(acquisition.id),
          purchaseNumber: String(acquisition.number),
          supplierName: String(acquisition.supplier_name),
          purchasedAt:
            acquisition.purchased_at instanceof Date
              ? acquisition.purchased_at.toISOString()
              : String(acquisition.purchased_at),
        }
      : null,
    usage: usageRows.map((row) => {
      const catalogItem =
        row.item_kind === 'material'
          ? materialById.get(Number(row.item_id))
          : componentById.get(Number(row.item_id))
      return {
        itemKind: String(row.item_kind),
        itemId: Number(row.item_id),
        name: catalogItem?.name ?? `Item #${row.item_id}`,
        unit: catalogItem?.unit ?? 'unit',
        usedQty: String(row.used_qty),
        wastedQty: String(row.wasted_qty),
      }
    }),
    jobs: jobs.map((j) => ({
      id: j.id,
      number: j.number,
      status: j.status,
      startedAt: j.startedAt?.toISO() ?? null,
      completedAt: j.completedAt?.toISO() ?? null,
      totalCost: j.totalCost,
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      kind: e.kind,
      description: e.description,
      amount: e.amount,
      incurredAt: e.incurredAt.toISO(),
    })),
  }
}
