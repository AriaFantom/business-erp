import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import ProductionJob from '#models/production_job'
import JobMaterialConsumption from '#models/job_material_consumption'
import JobExpense from '#models/job_expense'
import Inventory from '#models/inventory'
import Product from '#models/product'
import ProductRecipe from '#models/product_recipe'
import type User from '#models/user'
import { applyMovement, invalidateSnapshotCache } from '#services/inventory_service'
import { audit } from '#services/audit'
import { nextDocNumber } from '#services/numbering'
import { InsufficientStockError, InvalidStateError } from '#services/domain_errors'

const MAX_REPRINT_CHAIN = 50

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

/**
 * Recompute and persist the four totals on a job. Must run inside the same
 * transaction as the consumption / expense / completion that triggered it.
 */
export async function recomputeJobTotals(
  jobId: number,
  trx: TransactionClientContract
): Promise<void> {
  const consumptions = await JobMaterialConsumption.query({ client: trx }).where('job_id', jobId)
  const expenses = await JobExpense.query({ client: trx }).where('job_id', jobId)

  let materialCost = 0
  let componentCost = 0
  for (const c of consumptions) {
    const cost = Number(c.lineCost)
    if (c.itemKind === 'material') materialCost += cost
    else if (c.itemKind === 'component') componentCost += cost
  }
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalCost = materialCost + componentCost + expenseTotal

  const job = await ProductionJob.query({ client: trx })
    .where('id', jobId)
    .forUpdate()
    .firstOrFail()
  const unitCost = job.producedQty > 0 ? totalCost / job.producedQty : 0

  job.totalMaterialCost = String(round2(materialCost))
  job.totalComponentCost = String(round2(componentCost))
  job.totalExpense = String(round2(expenseTotal))
  job.totalCost = String(round2(totalCost))
  job.unitCost = String(round4(unitCost))
  await job.save()
}

export async function createJob(input: {
  productId: number
  plannedQty: number
  parentJobId?: number | null
  note?: string | null
  actor: User
}): Promise<ProductionJob> {
  await Product.findOrFail(input.productId)
  if (input.parentJobId) await ProductionJob.findOrFail(input.parentJobId)

  return db.transaction(async (trx) => {
    const number = await nextDocNumber('JOB', trx)
    const job = new ProductionJob()
    job.number = number
    job.productId = input.productId
    job.parentJobId = input.parentJobId ?? null
    job.plannedQty = input.plannedQty
    job.producedQty = 0
    job.status = 'draft'
    job.totalMaterialCost = '0'
    job.totalComponentCost = '0'
    job.totalExpense = '0'
    job.totalCost = '0'
    job.unitCost = '0'
    job.note = input.note ?? null
    job.createdByUserId = input.actor.id
    job.useTransaction(trx)
    await job.save()

    await audit({
      actor: input.actor,
      action: 'job.create',
      targetType: 'job',
      targetId: job.id,
      payload: { number, productId: input.productId, plannedQty: input.plannedQty },
      trx,
    })

    return job
  })
}

export async function startJob(jobId: number, actor: User): Promise<ProductionJob> {
  const result = await db.transaction(async (trx) => {
    const job = await ProductionJob.query({ client: trx })
      .where('id', jobId)
      .forUpdate()
      .firstOrFail()
    if (job.status !== 'draft') {
      throw new InvalidStateError({
        entity: 'job',
        from: job.status,
        to: 'in_progress',
      })
    }
    job.status = 'in_progress'
    job.startedAt = DateTime.now()
    await job.save()
    await audit({
      actor,
      action: 'job.start',
      targetType: 'job',
      targetId: job.id,
      trx,
    })

    // Auto-consume the product recipe (BOM) learned from prior completed jobs.
    // Insufficient stock here rolls back the start so the user can purchase
    // missing inputs first.
    const recipe = await ProductRecipe.query({ client: trx }).where('product_id', job.productId)
    for (const r of recipe) {
      const qty = round4(Number(r.qtyPerUnit) * job.plannedQty)
      if (qty <= 0) continue
      await recordConsumptionInTrx(
        {
          jobId: job.id,
          itemKind: r.itemKind as 'material' | 'component',
          itemId: r.itemId,
          qtyConsumed: qty,
          reason: 'consume',
          actor,
        },
        trx
      )
    }
    return job
  })

  await invalidateSnapshotCache()
  return result
}

async function recordConsumptionInTrx(
  input: {
    jobId: number
    itemKind: 'material' | 'component'
    itemId: number
    qtyConsumed: number
    qtyWasted?: number
    reason?: 'consume' | 'reprint' | 'waste'
    actor: User
  },
  trx: TransactionClientContract
): Promise<JobMaterialConsumption> {
  const job = await ProductionJob.query({ client: trx })
    .where('id', input.jobId)
    .forUpdate()
    .firstOrFail()
  if (!['draft', 'in_progress'].includes(job.status)) {
    throw new InvalidStateError({
      entity: 'job',
      from: job.status,
      to: 'consume',
    })
  }

  // Capture avg cost at consume time so historical job costs stay stable
  // even if later purchases shift the average.
  const inv = await Inventory.query({ client: trx })
    .where('itemKind', input.itemKind)
    .where('itemId', input.itemId)
    .forUpdate()
    .first()
  if (!inv || Number(inv.qty) < input.qtyConsumed) {
    throw new InsufficientStockError({
      itemKind: input.itemKind,
      itemId: input.itemId,
      available: inv ? Number(inv.qty) : 0,
      requested: input.qtyConsumed,
    })
  }
  const unitCost = Number(inv.avgUnitCost)
  const lineCost = round2(unitCost * input.qtyConsumed)

  // Outbound stock movement; the inventory service handles the lock release.
  await applyMovement({
    itemKind: input.itemKind,
    itemId: input.itemId,
    qty: -input.qtyConsumed,
    unitCost,
    reason: 'job_consume',
    referenceType: 'job',
    referenceId: input.jobId,
    note: null,
    actor: input.actor,
    trx,
  })

  const consumption = new JobMaterialConsumption()
  consumption.jobId = input.jobId
  consumption.itemKind = input.itemKind
  consumption.itemId = input.itemId
  consumption.qtyConsumed = String(input.qtyConsumed)
  consumption.qtyWasted = String(input.qtyWasted ?? 0)
  consumption.unitCostAtConsume = String(unitCost)
  consumption.lineCost = String(lineCost)
  consumption.reason = input.reason ?? 'consume'
  consumption.createdByUserId = input.actor.id
  consumption.createdAt = DateTime.now()
  consumption.useTransaction(trx)
  await consumption.save()

  // Bump status to in_progress on first consumption while in draft.
  if (job.status === 'draft') {
    job.status = 'in_progress'
    job.startedAt = DateTime.now()
    await job.save()
  }

  await recomputeJobTotals(input.jobId, trx)
  await audit({
    actor: input.actor,
    action: 'job.consume',
    targetType: 'job',
    targetId: input.jobId,
    payload: {
      itemKind: input.itemKind,
      itemId: input.itemId,
      qty: input.qtyConsumed,
      unitCost,
    },
    trx,
  })
  return consumption
}

export async function recordConsumption(input: {
  jobId: number
  itemKind: 'material' | 'component'
  itemId: number
  qtyConsumed: number
  qtyWasted?: number
  reason?: 'consume' | 'reprint' | 'waste'
  actor: User
}): Promise<JobMaterialConsumption> {
  const result = await db.transaction(async (trx) => recordConsumptionInTrx(input, trx))
  await invalidateSnapshotCache()
  return result
}

export async function recordExpense(input: {
  jobId: number
  kind: 'electricity' | 'labor' | 'overhead' | 'other'
  description: string
  amount: number
  incurredAt?: DateTime
  actor: User
}): Promise<JobExpense> {
  return db.transaction(async (trx) => {
    const job = await ProductionJob.query({ client: trx })
      .where('id', input.jobId)
      .forUpdate()
      .firstOrFail()
    if (!['draft', 'in_progress', 'completed', 'failed'].includes(job.status)) {
      throw new InvalidStateError({
        entity: 'job',
        from: job.status,
        to: 'add_expense',
      })
    }
    const expense = new JobExpense()
    expense.jobId = input.jobId
    expense.kind = input.kind
    expense.description = input.description
    expense.amount = String(input.amount)
    expense.incurredAt = input.incurredAt ?? DateTime.now()
    expense.createdByUserId = input.actor.id
    expense.useTransaction(trx)
    await expense.save()

    await recomputeJobTotals(input.jobId, trx)
    await audit({
      actor: input.actor,
      action: 'job.expense',
      targetType: 'job',
      targetId: input.jobId,
      payload: { kind: input.kind, amount: input.amount },
      trx,
    })
    return expense
  })
}

export async function completeJob(input: {
  jobId: number
  producedQty: number
  actor: User
}): Promise<ProductionJob> {
  const result = await db.transaction(async (trx) => {
    const job = await ProductionJob.query({ client: trx })
      .where('id', input.jobId)
      .forUpdate()
      .firstOrFail()
    if (job.status !== 'in_progress' && job.status !== 'draft') {
      throw new InvalidStateError({
        entity: 'job',
        from: job.status,
        to: 'completed',
      })
    }
    if (input.producedQty <= 0) {
      throw new InvalidStateError({
        entity: 'job',
        from: job.status,
        to: 'completed (produced_qty must be > 0)',
      })
    }

    job.status = 'completed'
    job.producedQty = input.producedQty
    job.completedAt = DateTime.now()
    await job.save()

    await recomputeJobTotals(input.jobId, trx)

    // Credit the produced product into inventory at the per-unit cost just
    // recomputed. Re-read the job to pick up the freshly persisted unitCost.
    const refreshed = await ProductionJob.query({ client: trx })
      .where('id', input.jobId)
      .firstOrFail()
    const perUnitCost = Number(refreshed.unitCost)
    await applyMovement({
      itemKind: 'product',
      itemId: refreshed.productId,
      qty: input.producedQty,
      unitCost: perUnitCost,
      reason: 'job_produce',
      referenceType: 'job',
      referenceId: refreshed.id,
      note: null,
      actor: input.actor,
      trx,
    })

    await audit({
      actor: input.actor,
      action: 'job.complete',
      targetType: 'job',
      targetId: input.jobId,
      payload: { producedQty: input.producedQty, unitCost: perUnitCost },
      trx,
    })

    await upsertProductRecipeFromJob(refreshed, trx)

    return refreshed
  })

  await invalidateSnapshotCache()
  return result
}

/**
 * Refresh the product recipe (BOM) from the just-completed job's actual
 * consumptions, normalised to per-unit. Replaces any prior recipe for this
 * product so the latest run is the source of truth used by future startJob()
 * auto-consumption.
 */
async function upsertProductRecipeFromJob(
  job: ProductionJob,
  trx: TransactionClientContract
): Promise<void> {
  if (job.producedQty <= 0) return
  const consumptions = await JobMaterialConsumption.query({ client: trx }).where('job_id', job.id)
  if (consumptions.length === 0) {
    await ProductRecipe.query({ client: trx }).where('product_id', job.productId).delete()
    return
  }

  const totals = new Map<string, { itemKind: string; itemId: number; qty: number }>()
  for (const c of consumptions) {
    const key = `${c.itemKind}:${c.itemId}`
    const row = totals.get(key)
    if (row) row.qty += Number(c.qtyConsumed)
    else totals.set(key, { itemKind: c.itemKind, itemId: c.itemId, qty: Number(c.qtyConsumed) })
  }

  await ProductRecipe.query({ client: trx }).where('product_id', job.productId).delete()
  for (const row of totals.values()) {
    const qtyPerUnit = round4(row.qty / job.producedQty)
    if (qtyPerUnit <= 0) continue
    const recipe = new ProductRecipe()
    recipe.productId = job.productId
    recipe.itemKind = row.itemKind
    recipe.itemId = row.itemId
    recipe.qtyPerUnit = String(qtyPerUnit)
    recipe.learnedFromJobId = job.id
    recipe.useTransaction(trx)
    await recipe.save()
  }
}

export async function failJob(input: {
  jobId: number
  reason?: string | null
  actor: User
}): Promise<ProductionJob> {
  return db.transaction(async (trx) => {
    const job = await ProductionJob.query({ client: trx })
      .where('id', input.jobId)
      .forUpdate()
      .firstOrFail()
    if (!['in_progress', 'draft'].includes(job.status)) {
      throw new InvalidStateError({
        entity: 'job',
        from: job.status,
        to: 'failed',
      })
    }
    job.status = 'failed'
    job.completedAt = DateTime.now()
    if (input.reason) job.note = (job.note ? job.note + '\n\n' : '') + `Failed: ${input.reason}`
    await job.save()
    await audit({
      actor: input.actor,
      action: 'job.fail',
      targetType: 'job',
      targetId: input.jobId,
      payload: { reason: input.reason ?? null },
      trx,
    })
    return job
  })
}

export async function cancelJob(jobId: number, actor: User): Promise<ProductionJob> {
  return db.transaction(async (trx) => {
    const job = await ProductionJob.query({ client: trx })
      .where('id', jobId)
      .forUpdate()
      .firstOrFail()
    if (job.status !== 'draft') {
      throw new InvalidStateError({
        entity: 'job',
        from: job.status,
        to: 'cancelled',
      })
    }
    const consumed = await JobMaterialConsumption.query({ client: trx })
      .where('job_id', jobId)
      .first()
    if (consumed) {
      throw new InvalidStateError({
        entity: 'job',
        from: 'has consumptions',
        to: 'cancelled',
      })
    }
    job.status = 'cancelled'
    await job.save()
    await audit({
      actor,
      action: 'job.cancel',
      targetType: 'job',
      targetId: jobId,
      trx,
    })
    return job
  })
}

/**
 * Walk parent_job_id chain summing total_cost. Caps at MAX_REPRINT_CHAIN
 * to prevent runaway loops if data is corrupted.
 */
export async function totalChainCost(jobId: number): Promise<number> {
  let total = 0
  let cursor: number | null = jobId
  let hops = 0
  while (cursor !== null) {
    if (++hops > MAX_REPRINT_CHAIN) {
      throw new Error(`Reprint chain exceeds ${MAX_REPRINT_CHAIN} hops; suspected cycle.`)
    }
    const job: ProductionJob | null = await ProductionJob.find(cursor)
    if (!job) break
    total += Number(job.totalCost)
    cursor = job.parentJobId
  }
  return round2(total)
}

/**
 * Returns the latest finished unit cost for a product, used by the pricing
 * service. Falls back to weighted average across the most recent N completed
 * jobs when the latest job has produced_qty=0 (shouldn't happen, but defensive).
 */
export async function latestProductCost(productId: number): Promise<number | null> {
  const jobs = await ProductionJob.query()
    .where('product_id', productId)
    .where('status', 'completed')
    .orderBy('completed_at', 'desc')
    .limit(5)

  if (jobs.length === 0) return null

  let totalCost = 0
  let totalQty = 0
  for (const j of jobs) {
    totalCost += Number(j.totalCost)
    totalQty += j.producedQty
  }
  return totalQty > 0 ? round4(totalCost / totalQty) : null
}
