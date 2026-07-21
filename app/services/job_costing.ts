import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import ProductionJob from '#models/production_job'
import JobMaterialConsumption from '#models/job_material_consumption'
import Expense from '#models/expense'
import Inventory from '#models/inventory'
import Product from '#models/product'
import ProductRecipe from '#models/product_recipe'
import Machine from '#models/machine'
import Worker from '#models/worker'
import JobWorker from '#models/job_worker'
import ProductionJobStage from '#models/production_job_stage'
import type User from '#models/user'
import { applyMovement, invalidateSnapshotCache } from '#services/inventory_service'
import { effectiveHourlyRate } from '#services/worker_service'
import { audit } from '#services/audit'
import { nextDocNumber } from '#services/numbering'
import { nextStage, type StageLike } from '#services/stage_advancement'
import { DomainError, InsufficientStockError, InvalidStateError } from '#services/domain_errors'

const MAX_REPRINT_CHAIN = 50

export async function freeMachine(
  job: ProductionJob,
  trx: TransactionClientContract
): Promise<void> {
  if (!job.machineId) return
  const machine = await Machine.query({ client: trx })
    .where('id', job.machineId)
    .forUpdate()
    .first()
  if (!machine) return
  machine.status = 'idle'
  machine.currentJobId = null
  await machine.save()
}

/**
 * Release every worker still assigned to a job: back to idle, off the job, and
 * stamped with a release time. Mirrors freeMachine and is called from the same
 * places (complete / fail / cancel) so a finished job never holds people.
 */
export async function freeWorkers(
  job: ProductionJob,
  trx: TransactionClientContract
): Promise<void> {
  const now = DateTime.now()
  const assignments = await JobWorker.query({ client: trx })
    .where('job_id', job.id)
    .whereNull('released_at')
    .forUpdate()
  for (const assignment of assignments) {
    assignment.releasedAt = now
    await assignment.save()
  }

  const workers = await Worker.query({ client: trx }).where('current_job_id', job.id).forUpdate()
  for (const worker of workers) {
    // A worker deactivated mid-job stays inactive; only free the busy ones.
    if (worker.status === 'working') worker.status = 'idle'
    worker.currentJobId = null
    await worker.save()
  }
}

/** The scheduler's synthetic actor has no user id; real users always do. */
function isSystemActor(actor: User): boolean {
  const id: number | null | undefined = actor.id
  return id === null || id === undefined
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

/**
 * Sum stage run time (completed_at - started_at, in minutes) across every
 * stage of a job that actually ran to completion. Stages that never started
 * or are still open are excluded. Rounded to the nearest minute, clamped
 * to >= 0 in case of clock skew.
 */
export async function computeMachineRunMinutes(
  jobId: number,
  trx: TransactionClientContract
): Promise<number> {
  const row = await trx
    .from('production_job_stages')
    .where('job_id', jobId)
    .whereNotNull('started_at')
    .whereNotNull('completed_at')
    .select(
      db.raw('COALESCE(SUM(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60), 0) as minutes')
    )
    .first()
  const minutes = Math.round(Number(row?.minutes ?? 0))
  return Math.max(0, minutes)
}

/**
 * Recompute and persist the four totals on a job. Must run inside the same
 * transaction as the consumption / expense / completion that triggered it.
 *
 * total_machine_cost and total_labour_cost are only ever set by
 * completeJobInTrx (at completion time); for draft/in_progress/paused/
 * awaiting_confirmation jobs they stay at their '0' default, so folding them
 * into totalCost here is a no-op for the material-return and expense-add paths
 * that call this before completion.
 */
export async function recomputeJobTotals(
  jobId: number,
  trx: TransactionClientContract
): Promise<void> {
  const consumptions = await JobMaterialConsumption.query({ client: trx }).where('job_id', jobId)
  const expenses = await Expense.query({ client: trx }).where('job_id', jobId)

  let materialCost = 0
  let componentCost = 0
  for (const c of consumptions) {
    const cost = Number(c.lineCost)
    if (c.itemKind === 'material') materialCost += cost
    else if (c.itemKind === 'component') componentCost += cost
  }
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0)

  const job = await ProductionJob.query({ client: trx })
    .where('id', jobId)
    .forUpdate()
    .firstOrFail()
  const totalCost =
    materialCost +
    componentCost +
    expenseTotal +
    Number(job.totalMachineCost) +
    Number(job.totalLabourCost)
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

export interface StartJobStageInput {
  name: string
  durationMinutes: number
}

export interface StartJobConsumptionInput {
  itemKind: 'material' | 'component'
  itemId: number
  qtyConsumed: number
}

export async function startJob(input: {
  jobId: number
  machineId?: number | null
  workerIds?: number[]
  stages: StartJobStageInput[]
  consumptions: StartJobConsumptionInput[]
  actor: User
}): Promise<ProductionJob> {
  if (input.stages.length === 0) {
    throw new DomainError({ code: 'INVALID_INPUT', message: 'A job must have at least one stage.' })
  }
  // De-duplicate so the same person can't be double-booked on one job (the
  // job_workers unique index would reject it anyway, less legibly).
  const workerIds = [...new Set(input.workerIds ?? [])]
  if (!input.machineId && workerIds.length === 0) {
    throw new DomainError({
      code: 'INVALID_INPUT',
      message: 'Assign a machine, at least one worker, or both before starting the job.',
    })
  }
  if (!input.consumptions || input.consumptions.length === 0) {
    throw new DomainError({
      code: 'INVALID_INPUT',
      message: 'Select at least one material or component to consume before starting the job.',
    })
  }

  const result = await db.transaction(async (trx) => {
    const job = await ProductionJob.query({ client: trx })
      .where('id', input.jobId)
      .forUpdate()
      .firstOrFail()
    if (job.status !== 'draft') {
      throw new InvalidStateError({ entity: 'job', from: job.status, to: 'in_progress' })
    }

    const machine = input.machineId
      ? await Machine.query({ client: trx }).where('id', input.machineId).forUpdate().firstOrFail()
      : null
    if (machine && machine.status !== 'idle') {
      throw new InvalidStateError({
        entity: 'machine',
        from: machine.status,
        to: `assign job ${job.id}`,
      })
    }

    // Lock every worker up-front so two concurrent starts can't claim the same
    // person; an already-busy or deactivated worker fails the whole start.
    const workers: Worker[] = []
    for (const workerId of workerIds) {
      const worker = await Worker.query({ client: trx })
        .where('id', workerId)
        .forUpdate()
        .firstOrFail()
      if (worker.status !== 'idle') {
        throw new InvalidStateError({
          entity: 'worker',
          from: worker.status,
          to: `assign job ${job.id}`,
        })
      }
      workers.push(worker)
    }

    // Insert all stages
    const now = DateTime.now()
    const stageRows: ProductionJobStage[] = []
    for (let i = 0; i < input.stages.length; i++) {
      const s = input.stages[i]
      const row = new ProductionJobStage()
      row.jobId = job.id
      row.sequence = i + 1
      row.name = s.name
      row.estimatedDurationMin = s.durationMinutes
      row.status = i === 0 ? 'in_progress' : 'pending'
      if (i === 0) {
        row.startedAt = now
        row.autoCompleteAt = now.plus({ minutes: s.durationMinutes })
      }
      row.useTransaction(trx)
      await row.save()
      stageRows.push(row)
    }

    job.status = 'in_progress'
    job.startedAt = now
    job.machineId = machine?.id ?? null
    job.currentStageId = stageRows[0].id
    job.estimatedDurationMin = stageRows[0].estimatedDurationMin
    job.autoCompleteAt = stageRows[0].autoCompleteAt
    await job.save()

    if (machine) {
      machine.status = 'running'
      machine.currentJobId = job.id
      await machine.save()
    }

    // Snapshot each worker's effective rate now, so a later pay change never
    // rewrites the cost of work already done.
    for (const worker of workers) {
      const assignment = new JobWorker()
      assignment.jobId = job.id
      assignment.workerId = worker.id
      assignment.assignedAt = now
      assignment.minutesWorked = 0
      assignment.hourlyRateAtAssign = String(effectiveHourlyRate(worker))
      assignment.lineCost = '0'
      assignment.useTransaction(trx)
      await assignment.save()

      worker.status = 'working'
      worker.currentJobId = job.id
      await worker.save()
    }

    await audit({
      actor: input.actor,
      action: 'job.start',
      targetType: 'job',
      targetId: job.id,
      payload: {
        machineId: machine?.id ?? null,
        workerIds,
        stages: input.stages.map((s) => ({ name: s.name, durationMinutes: s.durationMinutes })),
      },
      trx,
    })

    // Merge duplicate (itemKind, itemId) rows so callers can submit a flat list.
    const merged = new Map<string, StartJobConsumptionInput>()
    for (const c of input.consumptions) {
      const key = `${c.itemKind}:${c.itemId}`
      const prior = merged.get(key)
      if (prior) prior.qtyConsumed = round4(prior.qtyConsumed + c.qtyConsumed)
      else merged.set(key, { ...c, qtyConsumed: round4(c.qtyConsumed) })
    }
    for (const c of merged.values()) {
      if (c.qtyConsumed <= 0) continue
      await recordConsumptionInTrx(
        {
          jobId: job.id,
          itemKind: c.itemKind,
          itemId: c.itemId,
          qtyConsumed: c.qtyConsumed,
          reason: 'consume',
          actor: input.actor,
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
  if (!['in_progress', 'paused'].includes(job.status)) {
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
  jobId?: number | null
  machineId?: number | null
  kind: 'electricity' | 'labor' | 'overhead' | 'maintenance' | 'parts' | 'addon' | 'other'
  description: string
  amount: number
  incurredAt?: DateTime
  actor: User
}): Promise<Expense> {
  if (!input.jobId && !input.machineId) {
    throw new DomainError({
      code: 'INVALID_INPUT',
      message: 'Expense must be tied to a job or a machine.',
    })
  }
  return db.transaction(async (trx) => {
    if (input.jobId) {
      const job = await ProductionJob.query({ client: trx })
        .where('id', input.jobId)
        .forUpdate()
        .firstOrFail()
      if (
        ![
          'draft',
          'in_progress',
          'paused',
          'awaiting_confirmation',
          'completed',
          'failed',
        ].includes(job.status)
      ) {
        throw new InvalidStateError({
          entity: 'job',
          from: job.status,
          to: 'add_expense',
        })
      }
    }
    if (input.machineId) {
      await Machine.findOrFail(input.machineId)
    }
    const expense = new Expense()
    expense.jobId = input.jobId ?? null
    expense.machineId = input.machineId ?? null
    expense.kind = input.kind
    expense.description = input.description
    expense.amount = String(input.amount)
    expense.incurredAt = input.incurredAt ?? DateTime.now()
    expense.createdByUserId = input.actor.id
    expense.useTransaction(trx)
    await expense.save()

    if (input.jobId) {
      await recomputeJobTotals(input.jobId, trx)
    }
    await audit({
      actor: input.actor,
      action: 'expense.create',
      targetType: 'expense',
      targetId: expense.id,
      payload: {
        jobId: input.jobId ?? null,
        machineId: input.machineId ?? null,
        kind: input.kind,
        amount: input.amount,
      },
      trx,
    })
    return expense
  })
}

export async function completeJobInTrx(
  job: ProductionJob,
  producedQty: number,
  actor: User,
  trx: TransactionClientContract
): Promise<ProductionJob> {
  if (!['in_progress', 'paused', 'awaiting_confirmation'].includes(job.status)) {
    throw new InvalidStateError({
      entity: 'job',
      from: job.status,
      to: 'completed',
    })
  }
  if (producedQty <= 0) {
    throw new InvalidStateError({
      entity: 'job',
      from: job.status,
      to: 'completed (produced_qty must be > 0)',
    })
  }
  if (producedQty > job.plannedQty) {
    throw new InvalidStateError({
      entity: 'job',
      from: job.status,
      to: `completed (produced_qty ${producedQty} exceeds planned_qty ${job.plannedQty})`,
    })
  }

  const completedAt = DateTime.now()

  // Close out any stage still running. Confirming a job early (straight from
  // in_progress) would otherwise leave the current stage with no completed_at,
  // and run-time — hence machine *and* labour cost — would compute as zero.
  const openStages = await ProductionJobStage.query({ client: trx })
    .where('job_id', job.id)
    .where('status', 'in_progress')
    .forUpdate()
  for (const stage of openStages) {
    stage.status = 'completed'
    stage.completedAt = completedAt
    stage.autoCompleteAt = null
    await stage.save()
  }

  job.status = 'completed'
  job.producedQty = producedQty
  job.completedAt = completedAt
  job.autoCompleteAt = null
  job.currentStageId = null

  // Fold machine run time into the job's cost before totals/unit-cost are
  // (re)computed, so the finished-goods inbound valuation below reflects it.
  // machineId can be null (e.g. jobs created before machines were required,
  // or manually cleared) — minutes are still recorded, cost is just 0.
  const runMinutes = await computeMachineRunMinutes(job.id, trx)
  const machine = job.machineId
    ? await Machine.query({ client: trx }).where('id', job.machineId).first()
    : null
  const machineCost = machine ? round2((runMinutes / 60) * Number(machine.hourlyRate)) : 0
  job.machineMinutes = runMinutes
  job.totalMachineCost = String(machineCost)

  // Workers are on the job for the same wall-clock stage time the machine is,
  // so each assignment bills that run time at its snapshotted rate. Parallel
  // workers each bill their own hours — two people for an hour is two hours.
  const assignments = await JobWorker.query({ client: trx }).where('job_id', job.id).forUpdate()
  let labourMinutes = 0
  let labourCost = 0
  for (const assignment of assignments) {
    const lineCost = round2((runMinutes / 60) * Number(assignment.hourlyRateAtAssign))
    assignment.minutesWorked = runMinutes
    assignment.lineCost = String(lineCost)
    await assignment.save()
    labourMinutes += runMinutes
    labourCost += lineCost
  }
  job.labourMinutes = labourMinutes
  job.totalLabourCost = String(round2(labourCost))
  await job.save()

  await recomputeJobTotals(job.id, trx)

  const refreshed = await ProductionJob.query({ client: trx }).where('id', job.id).firstOrFail()
  const perUnitCost = Number(refreshed.unitCost)
  await applyMovement({
    itemKind: 'product',
    itemId: refreshed.productId,
    qty: producedQty,
    unitCost: perUnitCost,
    reason: 'job_produce',
    referenceType: 'job',
    referenceId: refreshed.id,
    note: null,
    actor,
    trx,
  })
  await freeMachine(refreshed, trx)
  await freeWorkers(refreshed, trx)

  await audit({
    actor,
    action: 'job.complete',
    targetType: 'job',
    targetId: job.id,
    payload: { producedQty, unitCost: perUnitCost, auto: isSystemActor(actor) },
    trx,
  })

  await upsertProductRecipeFromJob(refreshed, trx)

  return refreshed
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
    return completeJobInTrx(job, input.producedQty, input.actor, trx)
  })

  await invalidateSnapshotCache()
  return result
}

export async function confirmJob(input: {
  jobId: number
  producedQty: number
  actor: User
}): Promise<ProductionJob> {
  const current = await ProductionJob.findOrFail(input.jobId)
  if (!['in_progress', 'paused', 'awaiting_confirmation'].includes(current.status)) {
    throw new InvalidStateError({ entity: 'job', from: current.status, to: 'completed' })
  }
  if (input.producedQty <= 0) {
    return failJob({ jobId: input.jobId, reason: 'confirmed zero output', actor: input.actor })
  }
  return completeJob({
    jobId: input.jobId,
    producedQty: input.producedQty,
    actor: input.actor,
  })
}

async function upsertProductRecipeFromJob(
  job: ProductionJob,
  trx: TransactionClientContract
): Promise<void> {
  // Never delete learned recipes: a zero-output or zero-consumption completion
  // simply doesn't produce a new recipe version.
  if (job.producedQty <= 0) return
  const consumptions = await JobMaterialConsumption.query({ client: trx }).where('job_id', job.id)
  if (consumptions.length === 0) return

  const totals = new Map<string, { itemKind: string; itemId: number; qty: number }>()
  for (const c of consumptions) {
    const key = `${c.itemKind}:${c.itemId}`
    const row = totals.get(key)
    if (row) row.qty += Number(c.qtyConsumed)
    else totals.set(key, { itemKind: c.itemKind, itemId: c.itemId, qty: Number(c.qtyConsumed) })
  }

  const maxRow = await ProductRecipe.query({ client: trx })
    .where('product_id', job.productId)
    .max('version as max_version')
    .first()
  const maxVersion = Number(maxRow?.$extras.max_version ?? 0)

  await ProductRecipe.query({ client: trx })
    .where('product_id', job.productId)
    .where('is_current', true)
    .update({ is_current: false })

  for (const row of totals.values()) {
    const qtyPerUnit = round4(row.qty / job.producedQty)
    if (qtyPerUnit <= 0) continue
    const recipe = new ProductRecipe()
    recipe.productId = job.productId
    recipe.itemKind = row.itemKind
    recipe.itemId = row.itemId
    recipe.qtyPerUnit = String(qtyPerUnit)
    recipe.version = maxVersion + 1
    recipe.isCurrent = true
    recipe.learnedFromJobId = job.id
    recipe.useTransaction(trx)
    await recipe.save()
  }
}

/**
 * Return every not-yet-returned, not-wasted consumed quantity of a job back
 * to stock at the cost it was consumed at. Line costs are shrunk so the job
 * only carries the cost of what was actually lost (wasted + kept).
 * No-ops when there is nothing to return. Returns the count of returned lines.
 */
async function returnJobMaterials(
  job: ProductionJob,
  trx: TransactionClientContract,
  actor: User
): Promise<number> {
  const consumptions = await JobMaterialConsumption.query({ client: trx })
    .where('job_id', job.id)
    .forUpdate()

  let returnedLines = 0
  for (const c of consumptions) {
    const returnable = Number(c.qtyConsumed) - Number(c.qtyWasted ?? 0) - Number(c.qtyReturned)
    if (returnable <= 0) continue

    await applyMovement({
      itemKind: c.itemKind as 'material' | 'component',
      itemId: c.itemId,
      qty: returnable,
      unitCost: Number(c.unitCostAtConsume),
      reason: 'job_return',
      referenceType: 'job',
      referenceId: job.id,
      note: null,
      actor,
      trx,
    })

    const qtyReturnedAfter = Number(c.qtyReturned) + returnable
    c.qtyReturned = String(qtyReturnedAfter)
    c.lineCost = String(
      round2(Number(c.unitCostAtConsume) * (Number(c.qtyConsumed) - qtyReturnedAfter))
    )
    await c.save()
    returnedLines++
  }

  if (returnedLines > 0) {
    await recomputeJobTotals(job.id, trx)
  }
  return returnedLines
}

// failJob/cancelJob never book finished goods, so machine_minutes and
// total_machine_cost are intentionally left at their '0' default — there's
// no output to fold the machine-hour cost into.
export async function failJob(input: {
  jobId: number
  reason?: string | null
  returnMaterials?: boolean
  actor: User
}): Promise<ProductionJob> {
  let returnedLines = 0
  const result = await db.transaction(async (trx) => {
    const job = await ProductionJob.query({ client: trx })
      .where('id', input.jobId)
      .forUpdate()
      .firstOrFail()
    if (!['in_progress', 'draft', 'paused', 'awaiting_confirmation'].includes(job.status)) {
      throw new InvalidStateError({
        entity: 'job',
        from: job.status,
        to: 'failed',
      })
    }
    if (input.returnMaterials) {
      returnedLines = await returnJobMaterials(job, trx, input.actor)
    }
    job.status = 'failed'
    job.completedAt = DateTime.now()
    if (input.reason) job.note = (job.note ? job.note + '\n\n' : '') + `Failed: ${input.reason}`
    await job.save()
    await freeMachine(job, trx)
    await freeWorkers(job, trx)
    await audit({
      actor: input.actor,
      action: 'job.fail',
      targetType: 'job',
      targetId: input.jobId,
      payload: { reason: input.reason ?? null, returnedLines },
      trx,
    })
    return job
  })
  if (returnedLines > 0) await invalidateSnapshotCache()
  return result
}

export async function cancelJob(jobId: number, actor: User): Promise<ProductionJob> {
  let returnedLines = 0
  const result = await db.transaction(async (trx) => {
    const job = await ProductionJob.query({ client: trx })
      .where('id', jobId)
      .forUpdate()
      .firstOrFail()
    if (!['draft', 'in_progress', 'paused', 'awaiting_confirmation'].includes(job.status)) {
      throw new InvalidStateError({
        entity: 'job',
        from: job.status,
        to: 'cancelled',
      })
    }

    // Unused materials go back to stock; no-op when nothing was consumed.
    returnedLines = await returnJobMaterials(job, trx, actor)

    // Close out any stages that never ran to completion.
    const now = DateTime.now()
    const openStages = await ProductionJobStage.query({ client: trx })
      .where('job_id', jobId)
      .whereIn('status', ['pending', 'in_progress'])
      .forUpdate()
    for (const stage of openStages) {
      stage.status = 'skipped'
      stage.completedAt = now
      await stage.save()
    }

    job.status = 'cancelled'
    job.autoCompleteAt = null
    job.currentStageId = null
    await job.save()
    await freeMachine(job, trx)
    await freeWorkers(job, trx)
    await audit({
      actor,
      action: 'job.cancel',
      targetType: 'job',
      targetId: jobId,
      payload: { returnedLines },
      trx,
    })
    return job
  })
  await invalidateSnapshotCache()
  return result
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

export async function pauseJob(jobId: number, actor: User): Promise<ProductionJob> {
  return db.transaction(async (trx) => {
    const job = await ProductionJob.query({ client: trx })
      .where('id', jobId)
      .forUpdate()
      .firstOrFail()
    if (job.status !== 'in_progress') {
      throw new InvalidStateError({ entity: 'job', from: job.status, to: 'paused' })
    }
    const now = DateTime.now()
    const remainingMs = (job.autoCompleteAt?.toMillis() ?? now.toMillis()) - now.toMillis()
    job.remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
    job.pausedAt = now
    job.autoCompleteAt = null
    job.status = 'paused'
    await job.save()

    if (job.currentStageId) {
      const stage = await ProductionJobStage.query({ client: trx })
        .where('id', job.currentStageId)
        .forUpdate()
        .firstOrFail()
      stage.autoCompleteAt = null
      await stage.save()
    }
    await audit({ actor, action: 'job.pause', targetType: 'job', targetId: job.id, trx })
    return job
  })
}

export async function resumeJob(jobId: number, actor: User): Promise<ProductionJob> {
  return db.transaction(async (trx) => {
    const job = await ProductionJob.query({ client: trx })
      .where('id', jobId)
      .forUpdate()
      .firstOrFail()
    if (job.status !== 'paused') {
      throw new InvalidStateError({ entity: 'job', from: job.status, to: 'in_progress' })
    }
    const now = DateTime.now()
    const remaining = job.remainingSeconds ?? 0
    const deadline = now.plus({ seconds: remaining })
    job.autoCompleteAt = deadline
    job.pausedAt = null
    job.remainingSeconds = null
    job.status = 'in_progress'
    await job.save()

    if (job.currentStageId) {
      const stage = await ProductionJobStage.query({ client: trx })
        .where('id', job.currentStageId)
        .forUpdate()
        .firstOrFail()
      stage.autoCompleteAt = deadline
      await stage.save()
    }
    await audit({ actor, action: 'job.resume', targetType: 'job', targetId: job.id, trx })
    return job
  })
}

async function advanceStageOrAwaitConfirmation(
  job: ProductionJob,
  finishedSequence: number,
  trx: TransactionClientContract,
  actor: User
): Promise<void> {
  const stages = await ProductionJobStage.query({ client: trx })
    .where('job_id', job.id)
    .orderBy('sequence', 'asc')
  const next = nextStage(
    stages as unknown as StageLike[],
    finishedSequence
  ) as ProductionJobStage | null
  const now = DateTime.now()
  if (next) {
    next.status = 'in_progress'
    next.startedAt = now
    next.autoCompleteAt = now.plus({ minutes: next.estimatedDurationMin })
    next.useTransaction(trx)
    await next.save()

    job.currentStageId = next.id
    job.estimatedDurationMin = next.estimatedDurationMin
    job.autoCompleteAt = next.autoCompleteAt
    await job.save()

    await audit({
      actor,
      action: 'job.stage_advance',
      targetType: 'job',
      targetId: job.id,
      payload: { toStageId: next.id, sequence: next.sequence },
      trx,
    })
  } else {
    // No more stages — auto-complete the job using the planned quantity so
    // the operator doesn't have to click "Confirm" after every print.
    await completeJobInTrx(job, job.plannedQty, actor, trx)
    await audit({
      actor,
      action: 'job.auto_timer_expired',
      targetType: 'job',
      targetId: job.id,
      trx,
    })
  }
}

export async function skipStage(jobId: number, actor: User): Promise<ProductionJob> {
  return db.transaction(async (trx) => {
    const job = await ProductionJob.query({ client: trx })
      .where('id', jobId)
      .forUpdate()
      .firstOrFail()
    if (!['in_progress', 'paused'].includes(job.status)) {
      throw new InvalidStateError({ entity: 'job', from: job.status, to: 'skip_stage' })
    }
    if (!job.currentStageId) {
      throw new InvalidStateError({ entity: 'job', from: 'no_current_stage', to: 'skip_stage' })
    }
    const stage = await ProductionJobStage.query({ client: trx })
      .where('id', job.currentStageId)
      .forUpdate()
      .firstOrFail()
    stage.status = 'skipped'
    stage.completedAt = DateTime.now()
    await stage.save()

    job.status = 'in_progress'
    await advanceStageOrAwaitConfirmation(job, stage.sequence, trx, actor)
    await audit({
      actor,
      action: 'job.stage_skip',
      targetType: 'job',
      targetId: job.id,
      payload: { skippedSequence: stage.sequence },
      trx,
    })
    return job
  })
}
