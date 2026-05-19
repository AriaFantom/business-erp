import Printer from '#models/printer'
import PurchaseItem from '#models/purchase_item'
import Expense from '#models/expense'
import ProductionJob from '#models/production_job'
import db from '@adonisjs/lucid/services/db'

export async function getPrintersIndexViewModel() {
  const printers = await Printer.query().orderBy('name', 'asc')

  // Sum lifetime expenses per printer.
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
  const itemIds = printers.map((p) => p.purchaseItemId).filter((x): x is number => !!x)
  const items = itemIds.length ? await PurchaseItem.query().whereIn('id', itemIds) : []
  const itemById = new Map(items.map((i) => [i.id, i]))

  return {
    printers: printers.map((p) => {
      const item = p.purchaseItemId ? itemById.get(p.purchaseItemId) : null
      const purchaseCost = item ? Number(item.lineTotal) : 0
      const expenseTotal = expensesById.get(p.id) ?? 0
      return {
        id: p.id,
        name: p.name,
        model: p.model,
        status: p.status,
        currentJobId: p.currentJobId,
        purchaseCost: String(purchaseCost),
        expenseTotal: String(expenseTotal),
        totalSpent: String(purchaseCost + expenseTotal),
        acquiredAt: p.acquiredAt?.toISO() ?? null,
      }
    }),
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
