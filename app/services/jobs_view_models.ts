import ProductionJob from '#models/production_job'
import JobMaterialConsumption from '#models/job_material_consumption'
import Expense from '#models/expense'
import Product from '#models/product'
import Material from '#models/material'
import Component from '#models/component'
import Inventory from '#models/inventory'
import Machine from '#models/machine'
import Worker from '#models/worker'
import JobWorker from '#models/job_worker'
import ProductionJobStage from '#models/production_job_stage'
import ProductRecipe from '#models/product_recipe'
import { totalChainCost } from '#services/job_costing'
import { effectiveHourlyRate } from '#services/worker_service'
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

/** Statuses that put a job on the shop floor (i.e. it is occupying resources). */
const RUNNING_STATUSES = ['in_progress', 'paused', 'awaiting_confirmation'] as const

export type RunningJobStatus = (typeof RUNNING_STATUSES)[number]

/**
 * The live shop-floor board: every job currently holding resources, with the
 * machine and people attached to it, plus the drafts waiting to be started.
 * Shaped so the page can draw worker → job → machine connections directly.
 */
export async function getProductionFloorViewModel() {
  const [running, drafts] = await Promise.all([
    ProductionJob.query()
      .whereIn('status', [...RUNNING_STATUSES])
      .orderBy('started_at', 'asc'),
    ProductionJob.query().where('status', 'draft').orderBy('created_at', 'desc').limit(50),
  ])

  const jobIds = running.map((j) => j.id)
  const productIds = [...new Set([...running, ...drafts].map((j) => j.productId))]
  const machineIds = running.map((j) => j.machineId).filter((x): x is number => !!x)

  const [assignments, products, machines, stages] = await Promise.all([
    jobIds.length
      ? JobWorker.query().whereIn('job_id', jobIds).whereNull('released_at')
      : Promise.resolve([]),
    productIds.length ? Product.query().whereIn('id', productIds) : Promise.resolve([]),
    machineIds.length ? Machine.query().whereIn('id', machineIds) : Promise.resolve([]),
    jobIds.length
      ? ProductionJobStage.query().whereIn('job_id', jobIds).orderBy('sequence', 'asc')
      : Promise.resolve([]),
  ])

  const workerIds = [...new Set(assignments.map((a) => a.workerId))]
  const workers = workerIds.length ? await Worker.query().whereIn('id', workerIds) : []

  const productById = new Map(products.map((p) => [p.id, p]))
  const machineById = new Map(machines.map((m) => [m.id, m]))
  const workerById = new Map(workers.map((w) => [w.id, w]))

  const assignmentsByJob = new Map<number, typeof assignments>()
  for (const a of assignments) {
    const list = assignmentsByJob.get(a.jobId) ?? []
    list.push(a)
    assignmentsByJob.set(a.jobId, list)
  }
  const stagesByJob = new Map<number, typeof stages>()
  for (const s of stages) {
    const list = stagesByJob.get(s.jobId) ?? []
    list.push(s)
    stagesByJob.set(s.jobId, list)
  }

  return {
    runningJobs: running.map((j) => {
      const machine = j.machineId ? machineById.get(j.machineId) : null
      const jobStages = stagesByJob.get(j.id) ?? []
      const currentStage = j.currentStageId
        ? (jobStages.find((s) => s.id === j.currentStageId) ?? null)
        : null
      return {
        id: j.id,
        number: j.number,
        // The query filters to RUNNING_STATUSES, so this narrowing holds.
        status: j.status as RunningJobStatus,
        productId: j.productId,
        productName: productById.get(j.productId)?.name ?? '—',
        plannedQty: j.plannedQty,
        producedQty: j.producedQty,
        startedAt: j.startedAt?.toISO() ?? null,
        autoCompleteAt: j.autoCompleteAt?.toISO() ?? null,
        estimatedDurationMin: j.estimatedDurationMin,
        pausedAt: j.pausedAt?.toISO() ?? null,
        remainingSeconds: j.remainingSeconds,
        currentStageId: j.currentStageId,
        currentStageName: currentStage?.name ?? null,
        machine: machine ? { id: machine.id, name: machine.name } : null,
        workers: (assignmentsByJob.get(j.id) ?? []).map((a) => ({
          id: a.workerId,
          name: workerById.get(a.workerId)?.name ?? `#${a.workerId}`,
          payType: workerById.get(a.workerId)?.payType ?? 'hourly',
          hourlyRateAtAssign: a.hourlyRateAtAssign,
        })),
        stages: jobStages.map((s) => ({
          id: s.id,
          sequence: s.sequence,
          name: s.name,
          estimatedDurationMin: s.estimatedDurationMin,
          status: s.status as JobStageStatus,
          startedAt: s.startedAt?.toISO() ?? null,
          completedAt: s.completedAt?.toISO() ?? null,
          autoCompleteAt: s.autoCompleteAt?.toISO() ?? null,
        })),
      }
    }),
    draftJobs: drafts.map((j) => ({
      id: j.id,
      number: j.number,
      productName: productById.get(j.productId)?.name ?? '—',
      plannedQty: j.plannedQty,
      createdAt: j.createdAt.toISO(),
    })),
    serverNow: DateTime.now().toISO(),
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
  const idleWorkers = await Worker.query().where('status', 'idle').orderBy('name', 'asc')
  const recipe = await ProductRecipe.query()
    .where('product_id', job.productId)
    .where('is_current', true)

  const assignments = await JobWorker.query().where('job_id', jobId).orderBy('assigned_at', 'asc')
  const assignedWorkerIds = assignments.map((a) => a.workerId)
  const assignedWorkerRows = assignedWorkerIds.length
    ? await Worker.query().whereIn('id', assignedWorkerIds)
    : []
  const workerById = new Map(assignedWorkerRows.map((w) => [w.id, w]))

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
      labourMinutes: job.labourMinutes,
      totalLabourCost: job.totalLabourCost,
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
    idleWorkers: idleWorkers.map((w) => ({
      id: w.id,
      name: w.name,
      payType: w.payType,
      effectiveHourlyRate: String(effectiveHourlyRate(w)),
    })),
    assignedWorkers: assignments.map((a) => ({
      id: a.id,
      workerId: a.workerId,
      name: workerById.get(a.workerId)?.name ?? `#${a.workerId}`,
      payType: workerById.get(a.workerId)?.payType ?? 'hourly',
      hourlyRateAtAssign: a.hourlyRateAtAssign,
      minutesWorked: a.minutesWorked,
      lineCost: a.lineCost,
      releasedAt: a.releasedAt?.toISO() ?? null,
    })),
    productRecipe: recipe.map((r) => ({
      itemKind: r.itemKind as 'material' | 'component',
      itemId: r.itemId,
      qtyPerUnit: r.qtyPerUnit,
    })),
    serverNow: DateTime.now().toISO(),
  }
}
