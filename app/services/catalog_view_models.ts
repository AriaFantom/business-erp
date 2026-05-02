import Material from '#models/material'
import Component from '#models/component'
import Product from '#models/product'
import ProductCategory from '#models/product_category'
import Supplier from '#models/supplier'
import Customer from '#models/customer'
import Inventory from '#models/inventory'
import StockMovement from '#models/stock_movement'

/**
 * Lean read-only projections for Inertia pages. These don't depend on the
 * actor — every gating decision is enforced at the route/controller layer
 * via Bouncer, so the page either renders this data or 403s upstream.
 */

export type MaterialRow = {
  id: number
  sku: string
  name: string
  type: string
  defaultUnitCost: string
  reorderThresholdG: string | null
  defaultSupplier: { id: number; name: string } | null
  isActive: boolean
}

export async function getMaterialsViewModel() {
  const materials = await Material.query()
    .preload('defaultSupplier')
    .orderBy('name', 'asc')
  return {
    materials: materials.map<MaterialRow>((m) => ({
      id: m.id,
      sku: m.sku,
      name: m.name,
      type: m.type,
      defaultUnitCost: m.defaultUnitCost,
      reorderThresholdG: m.reorderThresholdG,
      defaultSupplier: m.defaultSupplier
        ? { id: m.defaultSupplier.id, name: m.defaultSupplier.name }
        : null,
      isActive: m.isActive,
    })),
    suppliers: await listActiveSuppliers(),
  }
}

export type ComponentRow = {
  id: number
  sku: string
  name: string
  defaultUnitCost: string
  reorderThresholdQty: number | null
  defaultSupplier: { id: number; name: string } | null
  isActive: boolean
}

export async function getComponentsViewModel() {
  const components = await Component.query()
    .preload('defaultSupplier')
    .orderBy('name', 'asc')
  return {
    components: components.map<ComponentRow>((c) => ({
      id: c.id,
      sku: c.sku,
      name: c.name,
      defaultUnitCost: c.defaultUnitCost,
      reorderThresholdQty: c.reorderThresholdQty,
      defaultSupplier: c.defaultSupplier
        ? { id: c.defaultSupplier.id, name: c.defaultSupplier.name }
        : null,
      isActive: c.isActive,
    })),
    suppliers: await listActiveSuppliers(),
  }
}

export type ProductRow = {
  id: number
  sku: string
  name: string
  description: string | null
  category: { id: number; name: string } | null
  defaultProfitPct: string | null
  taxRatePct: string | null
  isActive: boolean
}

export async function getProductsViewModel() {
  const [products, categories] = await Promise.all([
    Product.query().preload('category').orderBy('name', 'asc'),
    ProductCategory.query().orderBy('name', 'asc'),
  ])
  return {
    products: products.map<ProductRow>((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      category: p.category ? { id: p.category.id, name: p.category.name } : null,
      defaultProfitPct: p.defaultProfitPct,
      taxRatePct: p.taxRatePct,
      isActive: p.isActive,
    })),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      defaultProfitPct: c.defaultProfitPct,
      taxRatePct: c.taxRatePct,
    })),
  }
}

export async function getProductCategoriesViewModel() {
  const categories = await ProductCategory.query().orderBy('name', 'asc')
  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      defaultProfitPct: c.defaultProfitPct,
      taxRatePct: c.taxRatePct,
    })),
  }
}

export type SupplierRow = {
  id: number
  name: string
  gstin: string | null
  email: string | null
  phone: string | null
  isActive: boolean
}

export async function getSuppliersViewModel() {
  const suppliers = await Supplier.query().orderBy('name', 'asc')
  return {
    suppliers: suppliers.map<SupplierRow>((s) => ({
      id: s.id,
      name: s.name,
      gstin: s.gstin,
      email: s.email,
      phone: s.phone,
      isActive: s.isActive,
    })),
  }
}

export async function listActiveSuppliers() {
  const suppliers = await Supplier.query()
    .where('is_active', true)
    .orderBy('name', 'asc')
  return suppliers.map((s) => ({ id: s.id, name: s.name }))
}

export type CustomerRow = {
  id: number
  name: string
  gstin: string | null
  email: string | null
  phone: string | null
  isActive: boolean
}

export async function getCustomersViewModel() {
  const customers = await Customer.query().orderBy('name', 'asc')
  return {
    customers: customers.map<CustomerRow>((c) => ({
      id: c.id,
      name: c.name,
      gstin: c.gstin,
      email: c.email,
      phone: c.phone,
      isActive: c.isActive,
    })),
  }
}

export type InventoryRow = {
  itemKind: string
  itemId: number
  itemSku: string
  itemName: string
  qty: string
  avgUnitCost: string
  unit: string
  reorderThreshold: string | null
  belowThreshold: boolean
}

export async function getInventoryViewModel() {
  const [inventory, materials, components, recentMovements] = await Promise.all([
    Inventory.query(),
    Material.query(),
    Component.query(),
    StockMovement.query()
      .orderBy('created_at', 'desc')
      .limit(50),
  ])

  const matById = new Map(materials.map((m) => [m.id, m]))
  const compById = new Map(components.map((c) => [c.id, c]))

  const rows: InventoryRow[] = []
  for (const inv of inventory) {
    if (inv.itemKind === 'material') {
      const m = matById.get(inv.itemId)
      if (!m) continue
      const threshold = m.reorderThresholdG !== null ? Number(m.reorderThresholdG) : null
      rows.push({
        itemKind: 'material',
        itemId: m.id,
        itemSku: m.sku,
        itemName: m.name,
        qty: inv.qty,
        avgUnitCost: inv.avgUnitCost,
        unit: m.unit,
        reorderThreshold: m.reorderThresholdG,
        belowThreshold: threshold !== null && Number(inv.qty) < threshold,
      })
    } else if (inv.itemKind === 'component') {
      const c = compById.get(inv.itemId)
      if (!c) continue
      const threshold =
        c.reorderThresholdQty !== null ? Number(c.reorderThresholdQty) : null
      rows.push({
        itemKind: 'component',
        itemId: c.id,
        itemSku: c.sku,
        itemName: c.name,
        qty: inv.qty,
        avgUnitCost: inv.avgUnitCost,
        unit: c.unit,
        reorderThreshold:
          c.reorderThresholdQty !== null ? String(c.reorderThresholdQty) : null,
        belowThreshold: threshold !== null && Number(inv.qty) < threshold,
      })
    }
  }

  // Stable sort: kind, then name
  rows.sort((a, b) => {
    if (a.itemKind !== b.itemKind) return a.itemKind < b.itemKind ? -1 : 1
    return a.itemName < b.itemName ? -1 : 1
  })

  // Items the actor can adjust against — both kinds, active rows only
  const adjustableItems = [
    ...materials
      .filter((m) => m.isActive)
      .map((m) => ({
        itemKind: 'material' as const,
        itemId: m.id,
        sku: m.sku,
        name: m.name,
        unit: m.unit,
      })),
    ...components
      .filter((c) => c.isActive)
      .map((c) => ({
        itemKind: 'component' as const,
        itemId: c.id,
        sku: c.sku,
        name: c.name,
        unit: c.unit,
      })),
  ]

  return {
    inventory: rows,
    recentMovements: recentMovements.map((m) => ({
      id: m.id,
      itemKind: m.itemKind,
      itemId: m.itemId,
      qty: m.qty,
      unitCost: m.unitCost,
      reason: m.reason,
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      note: m.note,
      createdAt: m.createdAt.toISO(),
    })),
    adjustableItems,
  }
}
