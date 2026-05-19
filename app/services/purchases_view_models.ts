import Purchase from '#models/purchase'
import PurchaseItem from '#models/purchase_item'
import Supplier from '#models/supplier'
import Material from '#models/material'
import Component from '#models/component'
import Printer from '#models/printer'

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

  return {
    purchases: purchases.map((p) => ({
      id: p.id,
      number: p.number,
      supplierId: p.supplierId,
      supplierName: supplierById.get(p.supplierId)?.name ?? '—',
      status: p.status,
      purchasedAt: p.purchasedAt?.toISO() ?? null,
      total: p.total,
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
  const printers = itemIds.length ? await Printer.query().whereIn('purchase_item_id', itemIds) : []
  const printersByItem = new Map<number, Array<{ id: number; name: string }>>()
  for (const p of printers) {
    if (!p.purchaseItemId) continue
    const arr = printersByItem.get(p.purchaseItemId) ?? []
    arr.push({ id: p.id, name: p.name })
    printersByItem.set(p.purchaseItemId, arr)
  }

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
        printers: printersByItem.get(it.id) ?? [],
      }
    }),
  }
}
