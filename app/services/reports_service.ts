import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Invoice from '#models/invoice'
import Inventory from '#models/inventory'
import Material from '#models/material'
import Component from '#models/component'
import ProductionJob from '#models/production_job'
import Product from '#models/product'

export type ProfitReport = {
  from: string
  to: string
  revenue: number
  cost: number
  profit: number
  invoiceCount: number
  productionCost: number
}

/**
 * Profit report: revenue from non-void invoices issued in [from, to] minus
 * production cost incurred for completed jobs in the same window. Coarse
 * but useful — refined cost-attribution would tie sales to specific jobs,
 * which v1 deliberately skips.
 */
export async function buildProfitReport(
  from: DateTime,
  to: DateTime
): Promise<ProfitReport> {
  const invoices = await Invoice.query()
    .where('issued_at', '>=', from.toSQL()!)
    .where('issued_at', '<=', to.toSQL()!)
    .whereNot('status', 'void')

  const revenue = invoices.reduce((s, i) => s + Number(i.total), 0)

  const completedJobs = await ProductionJob.query()
    .where('status', 'completed')
    .where('completed_at', '>=', from.toSQL()!)
    .where('completed_at', '<=', to.toSQL()!)
  const productionCost = completedJobs.reduce((s, j) => s + Number(j.totalCost), 0)

  return {
    from: from.toISO()!,
    to: to.toISO()!,
    revenue: round2(revenue),
    cost: round2(productionCost),
    profit: round2(revenue - productionCost),
    invoiceCount: invoices.length,
    productionCost: round2(productionCost),
  }
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
      if (
        c &&
        c.reorderThresholdQty !== null &&
        Number(inv.qty) < c.reorderThresholdQty
      ) {
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

  return {
    totalValuation: round2(total),
    lowStock,
    byKind: { material: round2(matVal), component: round2(compVal) },
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
export async function buildJobsReport(
  from: DateTime,
  to: DateTime
): Promise<JobsReportRow[]> {
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
