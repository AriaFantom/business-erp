import ProductionJob from '#models/production_job'
import JobMaterialConsumption from '#models/job_material_consumption'
import Expense from '#models/expense'
import Product from '#models/product'
import Material from '#models/material'
import Component from '#models/component'
import Inventory from '#models/inventory'
import Machine from '#models/machine'
import ProductionJobStage from '#models/production_job_stage'
import ProductRecipe from '#models/product_recipe'
import { totalChainCost } from '#services/job_costing'
import { DateTime } from 'luxon'

export type JobStatus =
  | 'draft'
  | 'in_progress'
  | 'paused'
  | 'awaiting_confirmation'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type JobStageStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'

export async function getJobsIndexViewModel(
  filters: { q?: string; status?: string; productId?: number } = {}
) {
  const query = ProductionJob.query().orderBy('created_at', 'desc').limit(500)
  if (filters.status && filters.status !== 'all') query.where('status', filters.status)
  if (filters.productId) query.where('product_id', filters.productId)
  if (filters.q) query.whereILike('number', `%${filters.q.trim()}%`)
  const [jobs, products] = await Promise.all([
    query,
    Product.query().where('is_active', true).orderBy('name', 'asc'),
  ])
  const productById = new Map(products.map((p) => [p.id, p]))

  return {
    jobs: jobs.map((j) => ({
      id: j.id,
      number: j.number,
      productId: j.productId,
      productName: productById.get(j.productId)?.name ?? '—',
      status: j.status,
      plannedQty: j.plannedQty,
      producedQty: j.producedQty,
      totalCost: j.totalCost,
      unitCost: j.unitCost,
      parentJobId: j.parentJobId,
      createdAt: j.createdAt.toISO(),
      machineId: j.machineId,
      autoCompleteAt: j.autoCompleteAt?.toISO() ?? null,
    })),
    products: products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
    })),
  }
}

export async function getJobShowViewModel(jobId: number) {
  const job = await ProductionJob.findOrFail(jobId)
  const [product, consumptions, expenses, materials, components, inventory, stages, machineRow] =
    await Promise.all([
      Product.find(job.productId),
      JobMaterialConsumption.query().where('job_id', jobId).orderBy('created_at', 'asc'),
      Expense.query().where('job_id', jobId).orderBy('incurred_at', 'asc'),
      Material.query().where('is_active', true).orderBy('name', 'asc'),
      Component.query().where('is_active', true).orderBy('name', 'asc'),
      Inventory.query(),
      ProductionJobStage.query().where('job_id', jobId).orderBy('sequence', 'asc'),
      job.machineId ? Machine.find(job.machineId) : Promise.resolve(null),
    ])

  const matById = new Map(materials.map((m) => [m.id, m]))
  const compById = new Map(components.map((c) => [c.id, c]))
  const invByKey = new Map(inventory.map((i) => [`${i.itemKind}:${i.itemId}`, i] as const))

  const chainCost = await totalChainCost(jobId)
  const idleMachines = await Machine.query().where('status', 'idle').orderBy('name', 'asc')
  const recipe = await ProductRecipe.query()
    .where('product_id', job.productId)
    .where('is_current', true)

  return {
    job: {
      id: job.id,
      number: job.number,
      status: job.status as JobStatus,
      productId: job.productId,
      productName: product?.name ?? '—',
      plannedQty: job.plannedQty,
      producedQty: job.producedQty,
      parentJobId: job.parentJobId,
      startedAt: job.startedAt?.toISO() ?? null,
      completedAt: job.completedAt?.toISO() ?? null,
      totalMaterialCost: job.totalMaterialCost,
      totalComponentCost: job.totalComponentCost,
      totalExpense: job.totalExpense,
      machineMinutes: job.machineMinutes,
      totalMachineCost: job.totalMachineCost,
      totalCost: job.totalCost,
      unitCost: job.unitCost,
      chainCost: String(chainCost),
      note: job.note,
      machineId: job.machineId,
      machineName: machineRow?.name ?? null,
      autoCompleteAt: job.autoCompleteAt?.toISO() ?? null,
      estimatedDurationMin: job.estimatedDurationMin,
      pausedAt: job.pausedAt?.toISO() ?? null,
      remainingSeconds: job.remainingSeconds,
      currentStageId: job.currentStageId,
    },
    consumptions: consumptions.map((c) => {
      const item = c.itemKind === 'material' ? matById.get(c.itemId) : compById.get(c.itemId)
      return {
        id: c.id,
        itemKind: c.itemKind,
        itemId: c.itemId,
        itemName: item?.name ?? '—',
        itemSku: item?.sku ?? '—',
        qtyConsumed: c.qtyConsumed,
        qtyWasted: c.qtyWasted,
        qtyReturned: c.qtyReturned,
        unitCostAtConsume: c.unitCostAtConsume,
        lineCost: c.lineCost,
        reason: c.reason,
        createdAt: c.createdAt.toISO(),
      }
    }),
    expenses: expenses.map((e) => ({
      id: e.id,
      kind: e.kind,
      description: e.description,
      amount: e.amount,
      incurredAt: e.incurredAt.toISO(),
    })),
    // Only items with stock on hand are consumable in production, so 0-qty
    // materials/components are excluded from the consume picker.
    inventoryItems: [
      ...materials.map((m) => ({
        itemKind: 'material' as const,
        itemId: m.id,
        sku: m.sku,
        name: m.name,
        unit: m.unit,
        onHand: invByKey.get(`material:${m.id}`)?.qty ?? '0',
      })),
      ...components.map((c) => ({
        itemKind: 'component' as const,
        itemId: c.id,
        sku: c.sku,
        name: c.name,
        unit: c.unit,
        onHand: invByKey.get(`component:${c.id}`)?.qty ?? '0',
      })),
    ].filter((it) => Number(it.onHand) > 0),
    stages: stages.map((s) => ({
      id: s.id,
      sequence: s.sequence,
      name: s.name,
      estimatedDurationMin: s.estimatedDurationMin,
      status: s.status as JobStageStatus,
      startedAt: s.startedAt?.toISO() ?? null,
      completedAt: s.completedAt?.toISO() ?? null,
      autoCompleteAt: s.autoCompleteAt?.toISO() ?? null,
    })),
    idleMachines: idleMachines.map((m) => ({ id: m.id, name: m.name })),
    productRecipe: recipe.map((r) => ({
      itemKind: r.itemKind as 'material' | 'component',
      itemId: r.itemId,
      qtyPerUnit: r.qtyPerUnit,
    })),
    serverNow: DateTime.now().toISO(),
  }
}
