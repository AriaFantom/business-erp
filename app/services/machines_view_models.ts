import Machine from '#models/machine'
import PurchaseItem from '#models/purchase_item'
import Expense from '#models/expense'
import ProductionJob from '#models/production_job'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

// Mirrors the union the machines pages expect; the schema column is a bare string.
export type MachineStatus = 'idle' | 'running' | 'maintenance' | 'offline' | 'retired'

type IndexFilters = { q?: string; status?: string }

/**
 * Run minutes over the last 30 days, grouped by machine — a single join of
 * production_job_stages to production_jobs (on job_id), summing completed
 * stage durations for jobs pinned to a machine. Avoids N+1 per-machine
 * queries.
 */
async function getRunMinutes30dByMachine(): Promise<Map<number, number>> {
  const since = DateTime.now().minus({ days: 30 }).toSQL()
  const rows = await db
    .from('production_job_stages as s')
    .innerJoin('production_jobs as j', 's.job_id', 'j.id')
    .whereNotNull('j.machine_id')
    .whereNotNull('s.started_at')
    .whereNotNull('s.completed_at')
    .where('s.completed_at', '>=', since)
    .groupBy('j.machine_id')
    .select('j.machine_id as machineId')
    .select(
      db.raw(
        'COALESCE(SUM(EXTRACT(EPOCH FROM (s.completed_at - s.started_at)) / 60), 0) as minutes'
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

  const [runMinutes30dByMachine, machineCost30dByMachine] = await Promise.all([
    getRunMinutes30dByMachine(),
    getMachineCost30dByMachine(),
  ])

  return {
    machines: filtered.map((m) => {
      const item = m.purchaseItemId ? itemById.get(m.purchaseItemId) : null
      const purchaseCost = item ? Number(item.lineTotal) : 0
      const expenseTotal = expensesById.get(m.id) ?? 0
      return {
        id: m.id,
        name: m.name,
        model: m.model,
        serialNumber: m.serialNumber,
        status: m.status as MachineStatus,
        currentJobId: m.currentJobId,
        hourlyRate: m.hourlyRate,
        purchaseCost: String(purchaseCost),
        expenseTotal: String(expenseTotal),
        totalSpent: String(purchaseCost + expenseTotal),
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
  const [jobs, expenses, item, runMinutes30dByMachine, machineCost30dByMachine, lifetimeRow] =
    await Promise.all([
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
    ])
  const purchaseCost = item ? Number(item.lineTotal) : 0
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0)
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
      purchaseCost: String(purchaseCost),
      expenseTotal: String(expenseTotal),
      totalSpent: String(purchaseCost + expenseTotal),
      runMinutes30d: runMinutes30dByMachine.get(machine.id) ?? 0,
      machineCost30d: String(machineCost30dByMachine.get(machine.id) ?? 0),
      lifetimeMachineMinutes: Math.round(Number(lifetimeRow?.minutes ?? 0)),
      lifetimeMachineCost: String(Number(lifetimeRow?.cost ?? 0)),
    },
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
