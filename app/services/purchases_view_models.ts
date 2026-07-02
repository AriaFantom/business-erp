import Purchase from '#models/purchase'
import PurchaseItem from '#models/purchase_item'
import PurchaseReturn from '#models/purchase_return'
import PurchaseReturnItem from '#models/purchase_return_item'
import PurchasePayment from '#models/purchase_payment'
import Supplier from '#models/supplier'
import Material from '#models/material'
import Component from '#models/component'
import Machine from '#models/machine'

export async function getPurchasesIndexViewModel(
  filters: { q?: string; status?: string; supplierId?: number } = {}
) {
  const query = Purchase.query().orderBy('created_at', 'desc').limit(500)
  if (filters.status && filters.status !== 'all') {
    query.where('status', filters.status)
  }
  if (filters.supplierId) {
    query.where('supplier_id', filters.supplierId)
  }
  if (filters.q) {
    const needle = `%${filters.q.trim()}%`
    query.whereILike('number', needle)
  }
  const [purchases, suppliers, materials, components] = await Promise.all([
    query,
    Supplier.query().where('is_active', true).orderBy('name', 'asc'),
    Material.query().where('is_active', true).orderBy('name', 'asc'),
    Component.query().where('is_active', true).orderBy('name', 'asc'),
  ])

  const supplierById = new Map(suppliers.map((s) => [s.id, s]))

  // Supplier-credit totals from returns, per purchase, for the balance column.
  const purchaseIds = purchases.map((p) => p.id)
  const returnSums = purchaseIds.length
    ? await PurchaseReturn.query()
        .whereIn('purchase_id', purchaseIds)
        .select('purchase_id')
        .sum('total as returns_total')
        .groupBy('purchase_id')
    : []
  const returnsByPurchase = new Map<number, number>(
    returnSums.map((r) => [r.purchaseId, Number(r.$extras.returns_total)])
  )
  const round2 = (n: number) => Math.round(n * 100) / 100

  return {
    purchases: purchases.map((p) => ({
      id: p.id,
      number: p.number,
      supplierId: p.supplierId,
      supplierName: supplierById.get(p.supplierId)?.name ?? '—',
      status: p.status,
      purchasedAt: p.purchasedAt?.toISO() ?? null,
      total: p.total,
      paidTotal: p.paidTotal,
      balanceDue:
        p.status === 'confirmed'
          ? String(
              round2(Number(p.total) - (returnsByPurchase.get(p.id) ?? 0) - Number(p.paidTotal))
            )
          : '0',
      confirmedAt: p.confirmedAt?.toISO() ?? null,
    })),
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
    materials: materials.map((m) => ({
      id: m.id,
      sku: m.sku,
      name: m.name,
      unit: m.unit,
      defaultUnitCost: m.defaultUnitCost,
    })),
    components: components.map((c) => ({
      id: c.id,
      sku: c.sku,
      name: c.name,
      unit: c.unit,
      defaultUnitCost: c.defaultUnitCost,
    })),
  }
}

export async function getPurchaseShowViewModel(id: number) {
  const purchase = await Purchase.findOrFail(id)
  const [items, supplier] = await Promise.all([
    PurchaseItem.query().where('purchase_id', id),
    Supplier.find(purchase.supplierId),
  ])

  // Decorate lines with item names for display
  const matIds = items.filter((i) => i.itemKind === 'material').map((i) => i.itemId)
  const compIds = items.filter((i) => i.itemKind === 'component').map((i) => i.itemId)
  const [materials, components] = await Promise.all([
    matIds.length ? Material.query().whereIn('id', matIds) : Promise.resolve([]),
    compIds.length ? Component.query().whereIn('id', compIds) : Promise.resolve([]),
  ])
  const matById = new Map(materials.map((m) => [m.id, m]))
  const compById = new Map(components.map((c) => [c.id, c]))

  const itemIds = items.map((i) => i.id)
  const machines = itemIds.length ? await Machine.query().whereIn('purchase_item_id', itemIds) : []

  // Returns (debit notes) against this purchase + already-returned qty per line.
  const returns = await PurchaseReturn.query().where('purchase_id', id).orderBy('id', 'desc')
  const payments = await PurchasePayment.query().where('purchase_id', id).orderBy('paid_at', 'desc')
  const returnItems = returns.length
    ? await PurchaseReturnItem.query().whereIn(
        'purchase_return_id',
        returns.map((r) => r.id)
      )
    : []
  const returnedByItem = new Map<number, number>()
  for (const ri of returnItems) {
    returnedByItem.set(
      ri.purchaseItemId,
      (returnedByItem.get(ri.purchaseItemId) ?? 0) + Number(ri.qty)
    )
  }
  const machinesByItem = new Map<number, Array<{ id: number; name: string }>>()
  for (const m of machines) {
    if (!m.purchaseItemId) continue
    const arr = machinesByItem.get(m.purchaseItemId) ?? []
    arr.push({ id: m.id, name: m.name })
    machinesByItem.set(m.purchaseItemId, arr)
  }

  const returnsTotal = returns.reduce((s, r) => s + Number(r.total), 0)
  const balanceDue =
    purchase.status === 'confirmed'
      ? Math.round((Number(purchase.total) - returnsTotal - Number(purchase.paidTotal)) * 100) / 100
      : 0

  return {
    purchase: {
      id: purchase.id,
      number: purchase.number,
      status: purchase.status,
      supplier: supplier ? { id: supplier.id, name: supplier.name } : null,
      purchasedAt: purchase.purchasedAt?.toISO() ?? null,
      subtotal: purchase.subtotal,
      taxTotal: purchase.taxTotal,
      total: purchase.total,
      paidTotal: purchase.paidTotal,
      returnsTotal: String(returnsTotal),
      balanceDue: String(balanceDue),
      note: purchase.note,
      confirmedAt: purchase.confirmedAt?.toISO() ?? null,
      cancelledAt: purchase.cancelledAt?.toISO() ?? null,
    },
    items: items.map((it) => {
      const item = it.itemKind === 'material' ? matById.get(it.itemId) : compById.get(it.itemId)
      return {
        id: it.id,
        itemKind: it.itemKind,
        itemId: it.itemId,
        itemName: item?.name ?? '—',
        itemSku: item?.sku ?? '—',
        qty: it.qty,
        unitCost: it.unitCost,
        taxRatePct: it.taxRatePct,
        lineSubtotal: it.lineSubtotal,
        lineTax: it.lineTax,
        lineTotal: it.lineTotal,
        returnedQty: returnedByItem.get(it.id) ?? 0,
        machines: machinesByItem.get(it.id) ?? [],
      }
    }),
    returns: returns.map((r) => ({
      id: r.id,
      number: r.number,
      createdAt: r.createdAt?.toISO() ?? null,
      total: r.total,
      note: r.note,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      paidAt: p.paidAt?.toISO() ?? null,
      reference: p.reference,
      note: p.note,
    })),
  }
}
