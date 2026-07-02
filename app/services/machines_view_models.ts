import Machine from '#models/machine'
import PurchaseItem from '#models/purchase_item'
import Expense from '#models/expense'
import ProductionJob from '#models/production_job'
import db from '@adonisjs/lucid/services/db'

// Mirrors the union the machines pages expect; the schema column is a bare string.
export type MachineStatus = 'idle' | 'running' | 'maintenance' | 'offline' | 'retired'

type IndexFilters = { q?: string; status?: string }

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
        purchaseCost: String(purchaseCost),
        expenseTotal: String(expenseTotal),
        totalSpent: String(purchaseCost + expenseTotal),
        acquiredAt: m.acquiredAt?.toISO() ?? null,
      }
    }),
    filters: { q, status },
    counts,
  }
}

export async function getMachineShowViewModel(id: number) {
  const machine = await Machine.findOrFail(id)
  const [jobs, expenses, item] = await Promise.all([
    ProductionJob.query().where('machine_id', id).orderBy('started_at', 'desc').limit(50),
    Expense.query().where('machine_id', id).orderBy('incurred_at', 'desc'),
    machine.purchaseItemId ? PurchaseItem.find(machine.purchaseItemId) : null,
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
      purchaseCost: String(purchaseCost),
      expenseTotal: String(expenseTotal),
      totalSpent: String(purchaseCost + expenseTotal),
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
