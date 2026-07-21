import db from '@adonisjs/lucid/services/db'
import Worker from '#models/worker'
import WorkerPayment from '#models/worker_payment'
import type User from '#models/user'
import { audit } from '#services/audit'
import { DomainError, InvalidStateError } from '#services/domain_errors'
import { DateTime } from 'luxon'

/** Mirrors the union the workers pages expect; the schema column is a bare string. */
export type WorkerStatus = 'idle' | 'working' | 'inactive'
export type PayType = 'hourly' | 'monthly'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * The rate a worker's time is costed into a job at.
 *
 * Hourly workers use their stated rate. Monthly workers are salaried, so the
 * hourly figure is derived from the contracted month: salary / standard hours.
 * That keeps per-job COGS comparable across both pay types.
 */
export function effectiveHourlyRate(worker: {
  payType: string
  hourlyRate: string | number
  monthlySalary: string | number
  standardMonthlyHours: number
}): number {
  if (worker.payType === 'monthly') {
    const hours = Number(worker.standardMonthlyHours)
    if (!hours || hours <= 0) return 0
    return round2(Number(worker.monthlySalary) / hours)
  }
  return round2(Number(worker.hourlyRate))
}

export async function createWorker(input: {
  name: string
  phone?: string | null
  notes?: string | null
  payType: PayType
  hourlyRate?: number
  monthlySalary?: number
  standardMonthlyHours?: number
  joinedAt?: DateTime
  actor: User
}): Promise<Worker> {
  return db.transaction(async (trx) => {
    const exists = await Worker.query({ client: trx }).where('name', input.name).first()
    if (exists)
      throw new DomainError({
        code: 'DUPLICATE_NAME',
        message: `Worker "${input.name}" already exists.`,
      })
    const worker = new Worker()
    worker.name = input.name
    worker.phone = input.phone ?? null
    worker.notes = input.notes ?? null
    worker.payType = input.payType
    worker.hourlyRate = String(input.hourlyRate ?? 0)
    worker.monthlySalary = String(input.monthlySalary ?? 0)
    worker.standardMonthlyHours = input.standardMonthlyHours ?? 208
    worker.status = 'idle'
    worker.joinedAt = input.joinedAt ?? DateTime.now()
    worker.useTransaction(trx)
    await worker.save()
    await audit({
      actor: input.actor,
      action: 'worker.create',
      targetType: 'worker',
      targetId: worker.id,
      payload: { payType: input.payType },
      trx,
    })
    return worker
  })
}

export async function updateWorker(
  id: number,
  patch: {
    name?: string
    phone?: string | null
    notes?: string | null
    payType?: PayType
    hourlyRate?: number
    monthlySalary?: number
    standardMonthlyHours?: number
  },
  actor: User
): Promise<Worker> {
  return db.transaction(async (trx) => {
    const worker = await Worker.query({ client: trx }).where('id', id).forUpdate().firstOrFail()
    if (patch.name !== undefined) worker.name = patch.name
    if (patch.phone !== undefined) worker.phone = patch.phone
    if (patch.notes !== undefined) worker.notes = patch.notes
    if (patch.payType !== undefined) worker.payType = patch.payType
    if (patch.hourlyRate !== undefined) worker.hourlyRate = String(patch.hourlyRate)
    if (patch.monthlySalary !== undefined) worker.monthlySalary = String(patch.monthlySalary)
    if (patch.standardMonthlyHours !== undefined) {
      worker.standardMonthlyHours = patch.standardMonthlyHours
    }
    await worker.save()
    await audit({
      actor,
      action: 'worker.update',
      targetType: 'worker',
      targetId: id,
      payload: patch,
      trx,
    })
    return worker
  })
}

export async function deactivateWorker(id: number, actor: User): Promise<Worker> {
  return db.transaction(async (trx) => {
    const worker = await Worker.query({ client: trx }).where('id', id).forUpdate().firstOrFail()
    if (worker.status === 'working') {
      throw new InvalidStateError({ entity: 'worker', from: worker.status, to: 'inactive' })
    }
    worker.status = 'inactive'
    await worker.save()
    await audit({ actor, action: 'worker.deactivate', targetType: 'worker', targetId: id, trx })
    return worker
  })
}

export async function reactivateWorker(id: number, actor: User): Promise<Worker> {
  return db.transaction(async (trx) => {
    const worker = await Worker.query({ client: trx }).where('id', id).forUpdate().firstOrFail()
    if (worker.status !== 'inactive') {
      throw new InvalidStateError({ entity: 'worker', from: worker.status, to: 'idle' })
    }
    worker.status = 'idle'
    await worker.save()
    await audit({ actor, action: 'worker.reactivate', targetType: 'worker', targetId: id, trx })
    return worker
  })
}

export async function recordWorkerPayment(input: {
  workerId: number
  amount: number
  kind: 'wages' | 'salary' | 'advance' | 'bonus' | 'other'
  periodStart?: DateTime | null
  periodEnd?: DateTime | null
  note?: string | null
  paidAt?: DateTime
  actor: User
}): Promise<WorkerPayment> {
  if (input.amount <= 0) {
    throw new DomainError({ code: 'INVALID_INPUT', message: 'Payment amount must be positive.' })
  }
  if (input.periodStart && input.periodEnd && input.periodEnd < input.periodStart) {
    throw new DomainError({
      code: 'INVALID_INPUT',
      message: 'Pay period end cannot be before its start.',
    })
  }
  return db.transaction(async (trx) => {
    const worker = await Worker.query({ client: trx })
      .where('id', input.workerId)
      .forUpdate()
      .firstOrFail()

    const payment = new WorkerPayment()
    payment.workerId = worker.id
    payment.amount = String(round2(input.amount))
    payment.kind = input.kind
    payment.periodStart = input.periodStart ?? null
    payment.periodEnd = input.periodEnd ?? null
    payment.note = input.note ?? null
    payment.paidAt = input.paidAt ?? DateTime.now()
    payment.createdByUserId = input.actor.id
    payment.useTransaction(trx)
    await payment.save()

    await audit({
      actor: input.actor,
      action: 'worker.payment',
      targetType: 'worker',
      targetId: worker.id,
      payload: { amount: input.amount, kind: input.kind },
      trx,
    })
    return payment
  })
}
