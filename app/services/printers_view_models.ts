import Printer from '#models/printer'
import PurchaseItem from '#models/purchase_item'
import Expense from '#models/expense'
import ProductionJob from '#models/production_job'
import db from '@adonisjs/lucid/services/db'

type IndexFilters = { q?: string; status?: string }

export async function getPrintersIndexViewModel(filters: IndexFilters = {}) {
  const q = (filters.q ?? '').trim()
  const status = filters.status ?? 'all'

  const all = await Printer.query().orderBy('name', 'asc')

  const counts = {
    total: all.length,
    idle: all.filter((p) => p.status === 'idle').length,
    printing: all.filter((p) => p.status === 'printing').length,
    maintenance: all.filter((p) => p.status === 'maintenance').length,
    offline: all.filter((p) => p.status === 'offline').length,
    retired: all.filter((p) => p.status === 'retired').length,
  }

  const filtered = all.filter((p) => {
    if (status !== 'all' && p.status !== status) return false
    if (q) {
      const hay = `${p.name} ${p.model ?? ''} ${p.serialNumber ?? ''}`.toLowerCase()
      if (!hay.includes(q.toLowerCase())) return false
    }
    return true
  })

  // Sum lifetime expenses per printer (across the unfiltered set is fine —
  // we're displaying totals on rows we render).
  const expenseSums = await db
    .from('expenses')
    .whereNotNull('printer_id')
    .groupBy('printer_id')
    .select('printer_id')
    .sum({ sum: 'amount' })
  const expensesById = new Map<number, number>()
  for (const row of expenseSums) {
    expensesById.set(Number(row.printer_id), Number(row.sum) || 0)
  }

  // Resolve purchase cost via purchase_item_id when present.
  const itemIds = filtered.map((p) => p.purchaseItemId).filter((x): x is number => !!x)
  const items = itemIds.length ? await PurchaseItem.query().whereIn('id', itemIds) : []
  const itemById = new Map(items.map((i) => [i.id, i]))

  return {
    printers: filtered.map((p) => {
      const item = p.purchaseItemId ? itemById.get(p.purchaseItemId) : null
      const purchaseCost = item ? Number(item.lineTotal) : 0
      const expenseTotal = expensesById.get(p.id) ?? 0
      return {
        id: p.id,
        name: p.name,
        model: p.model,
        serialNumber: p.serialNumber,
        status: p.status,
        currentJobId: p.currentJobId,
        purchaseCost: String(purchaseCost),
        expenseTotal: String(expenseTotal),
        totalSpent: String(purchaseCost + expenseTotal),
        acquiredAt: p.acquiredAt?.toISO() ?? null,
      }
    }),
    filters: { q, status },
    counts,
  }
}

export async function getPrinterShowViewModel(id: number) {
  const printer = await Printer.findOrFail(id)
  const [jobs, expenses, item] = await Promise.all([
    ProductionJob.query().where('printer_id', id).orderBy('started_at', 'desc').limit(50),
    Expense.query().where('printer_id', id).orderBy('incurred_at', 'desc'),
    printer.purchaseItemId ? PurchaseItem.find(printer.purchaseItemId) : null,
  ])
  const purchaseCost = item ? Number(item.lineTotal) : 0
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0)
  return {
    printer: {
      id: printer.id,
      name: printer.name,
      model: printer.model,
      serialNumber: printer.serialNumber,
      status: printer.status,
      currentJobId: printer.currentJobId,
      notes: printer.notes,
      acquiredAt: printer.acquiredAt?.toISO() ?? null,
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
