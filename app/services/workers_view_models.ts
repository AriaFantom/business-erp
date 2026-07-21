import Worker from '#models/worker'
import WorkerPayment from '#models/worker_payment'
import JobWorker from '#models/job_worker'
import ProductionJob from '#models/production_job'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { effectiveHourlyRate, type WorkerStatus } from '#services/worker_service'

type IndexFilters = { q?: string; status?: string; payType?: string }

/**
 * Labour minutes and cost over the last 30 days, grouped by worker. Single
 * grouped query over job_workers so the index never issues per-worker queries.
 */
async function getWork30dByWorker(): Promise<Map<number, { minutes: number; cost: number }>> {
  const since = DateTime.now().minus({ days: 30 }).toSQL()
  const rows = await db
    .from('job_workers')
    .where('assigned_at', '>=', since)
    .groupBy('worker_id')
    .select('worker_id')
    .sum({ minutes: 'minutes_worked' })
    .sum({ cost: 'line_cost' })
  const byWorker = new Map<number, { minutes: number; cost: number }>()
  for (const row of rows) {
    byWorker.set(Number(row.worker_id), {
      minutes: Math.round(Number(row.minutes) || 0),
      cost: Number(row.cost) || 0,
    })
  }
  return byWorker
}

/** Total paid out per worker, all time. */
async function getPaidTotalByWorker(): Promise<Map<number, number>> {
  const rows = await db
    .from('worker_payments')
    .groupBy('worker_id')
    .select('worker_id')
    .sum({ sum: 'amount' })
  const byWorker = new Map<number, number>()
  for (const row of rows) {
    byWorker.set(Number(row.worker_id), Number(row.sum) || 0)
  }
  return byWorker
}

export async function getWorkersIndexViewModel(filters: IndexFilters = {}) {
  const q = (filters.q ?? '').trim()
  const status = filters.status ?? 'all'
  const payType = filters.payType ?? 'all'

  const all = await Worker.query().orderBy('name', 'asc')

  const counts = {
    total: all.length,
    idle: all.filter((w) => w.status === 'idle').length,
    working: all.filter((w) => w.status === 'working').length,
    inactive: all.filter((w) => w.status === 'inactive').length,
  }

  const filtered = all.filter((w) => {
    if (status !== 'all' && w.status !== status) return false
    if (payType !== 'all' && w.payType !== payType) return false
    if (q) {
      const hay = `${w.name} ${w.phone ?? ''}`.toLowerCase()
      if (!hay.includes(q.toLowerCase())) return false
    }
    return true
  })

  const [work30d, paidTotals] = await Promise.all([getWork30dByWorker(), getPaidTotalByWorker()])

  return {
    workers: filtered.map((w) => {
      const work = work30d.get(w.id)
      return {
        id: w.id,
        name: w.name,
        phone: w.phone,
        payType: w.payType,
        status: w.status as WorkerStatus,
        currentJobId: w.currentJobId,
        hourlyRate: w.hourlyRate,
        monthlySalary: w.monthlySalary,
        standardMonthlyHours: w.standardMonthlyHours,
        effectiveHourlyRate: String(effectiveHourlyRate(w)),
        minutes30d: work?.minutes ?? 0,
        labourCost30d: String(work?.cost ?? 0),
        paidTotal: String(paidTotals.get(w.id) ?? 0),
        joinedAt: w.joinedAt?.toISO() ?? null,
      }
    }),
    filters: { q, status, payType },
    counts,
  }
}

export async function getWorkerShowViewModel(id: number) {
  const worker = await Worker.findOrFail(id)
  const [assignments, payments, lifetimeRow, paidRow, currentJob] = await Promise.all([
    JobWorker.query().where('worker_id', id).orderBy('assigned_at', 'desc').limit(50),
    WorkerPayment.query().where('worker_id', id).orderBy('paid_at', 'desc').limit(100),
    // Lifetime totals aren't bounded by the 50-row history above.
    db
      .from('job_workers')
      .where('worker_id', id)
      .select(
        db.raw('COALESCE(SUM(minutes_worked), 0) as minutes'),
        db.raw('COALESCE(SUM(line_cost), 0) as cost')
      )
      .first(),
    db
      .from('worker_payments')
      .where('worker_id', id)
      .select(db.raw('COALESCE(SUM(amount), 0) as paid'))
      .first(),
    worker.currentJobId ? ProductionJob.find(worker.currentJobId) : null,
  ])

  const jobIds = assignments.map((a) => a.jobId)
  const jobs = jobIds.length ? await ProductionJob.query().whereIn('id', jobIds) : []
  const jobById = new Map(jobs.map((j) => [j.id, j]))

  const lifetimeCost = Number(lifetimeRow?.cost ?? 0)
  const paidTotal = Number(paidRow?.paid ?? 0)

  return {
    worker: {
      id: worker.id,
      name: worker.name,
      phone: worker.phone,
      notes: worker.notes,
      payType: worker.payType,
      status: worker.status as WorkerStatus,
      hourlyRate: worker.hourlyRate,
      monthlySalary: worker.monthlySalary,
      standardMonthlyHours: worker.standardMonthlyHours,
      effectiveHourlyRate: String(effectiveHourlyRate(worker)),
      joinedAt: worker.joinedAt?.toISO() ?? null,
      currentJobId: worker.currentJobId,
      currentJobNumber: currentJob?.number ?? null,
      lifetimeMinutes: Math.round(Number(lifetimeRow?.minutes ?? 0)),
      lifetimeLabourCost: String(lifetimeCost),
      paidTotal: String(paidTotal),
      // For hourly workers this is the gap between earned and paid. Salaried
      // workers are paid on the calendar, not per job, so it is informational.
      balance: String(Math.round((lifetimeCost - paidTotal) * 100) / 100),
    },
    assignments: assignments.map((a) => {
      const job = jobById.get(a.jobId)
      return {
        id: a.id,
        jobId: a.jobId,
        jobNumber: job?.number ?? `#${a.jobId}`,
        jobStatus: job?.status ?? 'unknown',
        assignedAt: a.assignedAt?.toISO() ?? null,
        releasedAt: a.releasedAt?.toISO() ?? null,
        minutesWorked: a.minutesWorked,
        hourlyRateAtAssign: a.hourlyRateAtAssign,
        lineCost: a.lineCost,
      }
    }),
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      kind: p.kind,
      periodStart: p.periodStart?.toISODate() ?? null,
      periodEnd: p.periodEnd?.toISODate() ?? null,
      note: p.note,
      paidAt: p.paidAt?.toISO() ?? null,
    })),
  }
}
