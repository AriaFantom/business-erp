import db from '@adonisjs/lucid/services/db'
import Material from '#models/material'
import Component from '#models/component'
import Product from '#models/product'
import ProductCategory from '#models/product_category'
import Supplier from '#models/supplier'
import Customer from '#models/customer'
import Inventory from '#models/inventory'
import StockMovement from '#models/stock_movement'
import { signCatalogImageUrl } from '#services/catalog_image_storage'

/**
 * Lean read-only projections for Inertia pages. These don't depend on the
 * actor — every gating decision is enforced at the route/controller layer
 * via Bouncer, so the page either renders this data or 403s upstream.
 */

type ListFilters = {
  q?: string
  status?: string // 'all' | 'active' | 'archived'
}

function applyStatus(
  query: { where: (col: string, val: unknown) => unknown },
  status: string | undefined
) {
  if (status === 'archived') {
    query.where('is_active', false)
  } else if (status !== 'all') {
    query.where('is_active', true)
  }
}

function applySearch(
  query: { whereILike: (col: string, val: string) => unknown; where: (cb: unknown) => unknown },
  q: string | undefined,
  cols: string[]
) {
  if (!q) return
  const needle = `%${q.trim()}%`
  query.where((sub: unknown) => {
    const s = sub as {
      whereILike: (col: string, v: string) => unknown
      orWhereILike: (col: string, v: string) => unknown
    }
    cols.forEach((c, i) => {
      if (i === 0) s.whereILike(c, needle)
      else s.orWhereILike(c, needle)
    })
  })
}

export type StatusCounts = { total: number; active: number; archived: number }

async function countByStatus<T extends { count: (col: string, alias?: string) => unknown }>(
  buildQuery: () => T
): Promise<StatusCounts> {
  const totalRow = (await (buildQuery() as any).count('* as total').first()) as {
    $extras: { total: number | string }
  } | null
  const activeRow = (await (buildQuery() as any)
    .where('is_active', true)
    .count('* as total')
    .first()) as { $extras: { total: number | string } } | null
  const total = Number(totalRow?.$extras.total ?? 0)
  const active = Number(activeRow?.$extras.total ?? 0)
  return { total, active, archived: Math.max(0, total - active) }
}

export type MaterialRow = {
  id: number
  sku: string
  name: string
  type: string
  unit: string
  defaultUnitCost: string
  reorderThresholdG: string | null
  defaultSupplier: { id: number; name: string } | null
  imageUrl: string | null
  isActive: boolean
}

export async function getMaterialsViewModel(filters: ListFilters & { type?: string } = {}) {
  const query = Material.query().preload('defaultSupplier').orderBy('name', 'asc')
  applyStatus(query as never, filters.status)
  applySearch(query as never, filters.q, ['name', 'sku'])
  if (filters.type && filters.type !== 'all') {
    query.where('type', filters.type)
  }
  const counts = await countByStatus(() => {
    const q = Material.query()
    applySearch(q as never, filters.q, ['name', 'sku'])
    if (filters.type && filters.type !== 'all') q.where('type', filters.type)
    return q
  })
  const materials = await query
  const signed = await Promise.all(materials.map((m) => signCatalogImageUrl(m.imageKey)))
  return {
    materials: materials.map<MaterialRow>((m, idx) => ({
      id: m.id,
      sku: m.sku,
      name: m.name,
      type: m.type,
      unit: m.unit,
      defaultUnitCost: m.defaultUnitCost,
      reorderThresholdG: m.reorderThresholdG,
      defaultSupplier: m.defaultSupplier
        ? { id: m.defaultSupplier.id, name: m.defaultSupplier.name }
        : null,
      imageUrl: signed[idx],
      isActive: m.isActive,
    })),
    counts,
    suppliers: await listActiveSuppliers(),
  }
}

export type ComponentRow = {
  id: number
  sku: string
  name: string
  unit: string
  defaultUnitCost: string
  reorderThresholdQty: number | null
  defaultSupplier: { id: number; name: string } | null
  imageUrl: string | null
  isActive: boolean
}

export async function getComponentsViewModel(filters: ListFilters = {}) {
  const query = Component.query().preload('defaultSupplier').orderBy('name', 'asc')
  applyStatus(query as never, filters.status)
  applySearch(query as never, filters.q, ['name', 'sku'])
  const counts = await countByStatus(() => {
    const q = Component.query()
    applySearch(q as never, filters.q, ['name', 'sku'])
    return q
  })
  const components = await query
  const signed = await Promise.all(components.map((c) => signCatalogImageUrl(c.imageKey)))
  return {
    components: components.map<ComponentRow>((c, idx) => ({
      id: c.id,
      sku: c.sku,
      name: c.name,
      unit: c.unit,
      defaultUnitCost: c.defaultUnitCost,
      reorderThresholdQty: c.reorderThresholdQty,
      defaultSupplier: c.defaultSupplier
        ? { id: c.defaultSupplier.id, name: c.defaultSupplier.name }
        : null,
      imageUrl: signed[idx],
      isActive: c.isActive,
    })),
    counts,
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
  imageUrl: string | null
  isActive: boolean
  inProductionQty: number
  soldQty: number
  attachmentCount: number
}

export async function getProductsViewModel(filters: ListFilters & { categoryId?: number } = {}) {
  const query = Product.query().preload('category').orderBy('name', 'asc')
  applyStatus(query as never, filters.status)
  applySearch(query as never, filters.q, ['name', 'sku'])
  if (filters.categoryId) {
    query.where('category_id', filters.categoryId)
  }
  const counts = await countByStatus(() => {
    const q = Product.query()
    applySearch(q as never, filters.q, ['name', 'sku'])
    if (filters.categoryId) q.where('category_id', filters.categoryId)
    return q
  })
  const [products, categories] = await Promise.all([
    query,
    ProductCategory.query().orderBy('name', 'asc'),
  ])
  const ids = products.map((p) => p.id)

  const [signed, productionRows, soldRows, attachmentRows] = await Promise.all([
    Promise.all(products.map((p) => signCatalogImageUrl(p.imageKey))),
    ids.length > 0
      ? db
          .from('production_jobs')
          .whereIn('product_id', ids)
          .where('status', 'in_progress')
          .groupBy('product_id')
          .select('product_id')
          .sum({ planned: 'planned_qty' })
          .sum({ produced: 'produced_qty' })
      : [],
    ids.length > 0
      ? db
          .from('sale_items')
          .join('sales', 'sales.id', 'sale_items.sale_id')
          .whereIn('sale_items.product_id', ids)
          .where('sales.status', 'confirmed')
          .groupBy('sale_items.product_id')
          .select('sale_items.product_id as product_id')
          .sum({ qty: 'sale_items.qty' })
      : [],
    ids.length > 0
      ? db
          .from('product_attachments')
          .whereIn('product_id', ids)
          .groupBy('product_id')
          .select('product_id')
          .count('* as total')
      : [],
  ])

  // "In production" = units still pending on in-progress jobs (planned − produced).
  // Avoids double-counting once a job records partial production.
  const inProductionByProduct = new Map<number, number>()
  for (const r of productionRows) {
    const planned = Number(r.planned ?? 0)
    const produced = Number(r.produced ?? 0)
    const remaining = Math.max(0, planned - produced)
    inProductionByProduct.set(Number(r.product_id), remaining)
  }
  const soldByProduct = new Map<number, number>()
  for (const r of soldRows) {
    soldByProduct.set(Number(r.product_id), Number(r.qty ?? 0))
  }
  const attachmentCountByProduct = new Map<number, number>()
  for (const r of attachmentRows as Array<{ product_id: number; total: string | number | null }>) {
    attachmentCountByProduct.set(Number(r.product_id), Number(r.total ?? 0))
  }

  return {
    products: products.map<ProductRow>((p, idx) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      category: p.category ? { id: p.category.id, name: p.category.name } : null,
      defaultProfitPct: p.defaultProfitPct,
      taxRatePct: p.taxRatePct,
      imageUrl: signed[idx],
      isActive: p.isActive,
      inProductionQty: inProductionByProduct.get(p.id) ?? 0,
      soldQty: soldByProduct.get(p.id) ?? 0,
      attachmentCount: attachmentCountByProduct.get(p.id) ?? 0,
    })),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      defaultProfitPct: c.defaultProfitPct,
      taxRatePct: c.taxRatePct,
    })),
    counts,
  }
}

export type ProductShowData = {
  product: {
    id: number
    sku: string
    name: string
    description: string | null
    category: { id: number; name: string } | null
    defaultProfitPct: string | null
    taxRatePct: string | null
    imageUrl: string | null
    isActive: boolean
    inProductionQty: number
    soldQty: number
    createdAt: string | null
    updatedAt: string | null
  }
  attachments: Array<{
    id: number
    originalName: string
    sizeBytes: number
    mimeType: string | null
    createdAt: string | null
  }>
}

export async function getProductShowViewModel(id: number): Promise<ProductShowData> {
  const product = await Product.query().where('id', id).preload('category').firstOrFail()
  const [imageUrl, attachments, productionRow, soldRow] = await Promise.all([
    signCatalogImageUrl(product.imageKey),
    db
      .from('product_attachments')
      .where('product_id', id)
      .orderBy('created_at', 'desc')
      .select('id', 'original_name', 'size_bytes', 'mime_type', 'created_at'),
    db
      .from('production_jobs')
      .where('product_id', id)
      .where('status', 'in_progress')
      .sum({ planned: 'planned_qty' })
      .sum({ produced: 'produced_qty' })
      .first(),
    db
      .from('sale_items')
      .join('sales', 'sales.id', 'sale_items.sale_id')
      .where('sale_items.product_id', id)
      .where('sales.status', 'confirmed')
      .sum({ qty: 'sale_items.qty' })
      .first(),
  ])
  const planned = Number(productionRow?.planned ?? 0)
  const produced = Number(productionRow?.produced ?? 0)
  const inProductionQty = Math.max(0, planned - produced)
  const soldQty = Number(soldRow?.qty ?? 0)
  return {
    product: {
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      category: product.category ? { id: product.category.id, name: product.category.name } : null,
      defaultProfitPct: product.defaultProfitPct,
      taxRatePct: product.taxRatePct,
      imageUrl,
      isActive: product.isActive,
      inProductionQty,
      soldQty,
      createdAt: product.createdAt?.toISO() ?? null,
      updatedAt: product.updatedAt?.toISO() ?? null,
    },
    attachments: (
      attachments as Array<{
        id: number
        original_name: string
        size_bytes: number | string
        mime_type: string | null
        created_at: Date | string | null
      }>
    ).map((a) => ({
      id: Number(a.id),
      originalName: String(a.original_name),
      sizeBytes: Number(a.size_bytes),
      mimeType: a.mime_type,
      createdAt:
        a.created_at instanceof Date
          ? a.created_at.toISOString()
          : a.created_at
            ? String(a.created_at)
            : null,
    })),
  }
}

export type ProductCategoryRow = {
  id: number
  name: string
  defaultProfitPct: string | null
  taxRatePct: string | null
  isActive: boolean
  totalSales: number
  totalUnitsSold: number
  productCount: number
}

export async function getProductCategoriesViewModel(filters: ListFilters = {}) {
  const query = ProductCategory.query().orderBy('name', 'asc')
  applyStatus(query as never, filters.status)
  applySearch(query as never, filters.q, ['name'])
  const counts = await countByStatus(() => {
    const q = ProductCategory.query()
    applySearch(q as never, filters.q, ['name'])
    return q
  })

  const [categories, salesRows, productCountRows] = await Promise.all([
    query,
    db
      .from('sale_items as si')
      .join('sales as s', 's.id', 'si.sale_id')
      .join('products as p', 'p.id', 'si.product_id')
      .whereNotNull('p.category_id')
      .where('s.status', 'confirmed')
      .groupBy('p.category_id')
      .select('p.category_id as categoryId')
      .sum({ revenue: 'si.line_total' })
      .sum({ units: 'si.qty' }),
    db
      .from('products')
      .whereNotNull('category_id')
      .groupBy('category_id')
      .select('category_id as categoryId')
      .count('* as total'),
  ])

  const salesByCat = new Map<number, { revenue: number; units: number }>()
  for (const r of salesRows as Array<{
    categoryId: number
    revenue: string | number | null
    units: string | number | null
  }>) {
    salesByCat.set(Number(r.categoryId), {
      revenue: Number(r.revenue ?? 0),
      units: Number(r.units ?? 0),
    })
  }
  const productCountByCat = new Map<number, number>()
  for (const r of productCountRows as Array<{
    categoryId: number
    total: string | number | null
  }>) {
    productCountByCat.set(Number(r.categoryId), Number(r.total ?? 0))
  }

  return {
    categories: categories.map<ProductCategoryRow>((c) => ({
      id: c.id,
      name: c.name,
      defaultProfitPct: c.defaultProfitPct,
      taxRatePct: c.taxRatePct,
      isActive: c.isActive,
      totalSales: salesByCat.get(c.id)?.revenue ?? 0,
      totalUnitsSold: salesByCat.get(c.id)?.units ?? 0,
      productCount: productCountByCat.get(c.id) ?? 0,
    })),
    counts,
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

export async function getSuppliersViewModel(filters: ListFilters = {}) {
  const query = Supplier.query().orderBy('name', 'asc')
  applyStatus(query as never, filters.status)
  applySearch(query as never, filters.q, ['name', 'email', 'phone', 'gstin'])
  const counts = await countByStatus(() => {
    const q = Supplier.query()
    applySearch(q as never, filters.q, ['name', 'email', 'phone', 'gstin'])
    return q
  })
  const suppliers = await query
  return {
    suppliers: suppliers.map<SupplierRow>((s) => ({
      id: s.id,
      name: s.name,
      gstin: s.gstin,
      email: s.email,
      phone: s.phone,
      isActive: s.isActive,
    })),
    counts,
  }
}

export async function listActiveSuppliers() {
  const suppliers = await Supplier.query().where('is_active', true).orderBy('name', 'asc')
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

export async function getCustomersViewModel(filters: ListFilters = {}) {
  const query = Customer.query().orderBy('name', 'asc')
  applyStatus(query as never, filters.status)
  applySearch(query as never, filters.q, ['name', 'email', 'phone', 'gstin'])
  const counts = await countByStatus(() => {
    const q = Customer.query()
    applySearch(q as never, filters.q, ['name', 'email', 'phone', 'gstin'])
    return q
  })
  const customers = await query
  return {
    customers: customers.map<CustomerRow>((c) => ({
      id: c.id,
      name: c.name,
      gstin: c.gstin,
      email: c.email,
      phone: c.phone,
      isActive: c.isActive,
    })),
    counts,
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

export async function getInventoryViewModel(
  filters: { q?: string; itemKind?: string; lowStock?: boolean } = {}
) {
  const [inventory, materials, components, products, recentMovements] = await Promise.all([
    Inventory.query(),
    Material.query(),
    Component.query(),
    Product.query(),
    StockMovement.query().orderBy('created_at', 'desc').limit(50),
  ])

  const matById = new Map(materials.map((m) => [m.id, m]))
  const compById = new Map(components.map((c) => [c.id, c]))
  const prodById = new Map(products.map((p) => [p.id, p]))

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
      const threshold = c.reorderThresholdQty !== null ? Number(c.reorderThresholdQty) : null
      rows.push({
        itemKind: 'component',
        itemId: c.id,
        itemSku: c.sku,
        itemName: c.name,
        qty: inv.qty,
        avgUnitCost: inv.avgUnitCost,
        unit: c.unit,
        reorderThreshold: c.reorderThresholdQty !== null ? String(c.reorderThresholdQty) : null,
        belowThreshold: threshold !== null && Number(inv.qty) < threshold,
      })
    } else if (inv.itemKind === 'product') {
      const p = prodById.get(inv.itemId)
      if (!p) continue
      rows.push({
        itemKind: 'product',
        itemId: p.id,
        itemSku: p.sku,
        itemName: p.name,
        qty: inv.qty,
        avgUnitCost: inv.avgUnitCost,
        unit: 'unit',
        reorderThreshold: null,
        belowThreshold: false,
      })
    }
  }

  const filtered = rows.filter((r) => {
    if (filters.itemKind && filters.itemKind !== 'all' && r.itemKind !== filters.itemKind)
      return false
    if (filters.lowStock && !r.belowThreshold) return false
    if (filters.q) {
      const needle = filters.q.trim().toLowerCase()
      if (!r.itemName.toLowerCase().includes(needle) && !r.itemSku.toLowerCase().includes(needle))
        return false
    }
    return true
  })

  filtered.sort((a, b) => {
    if (a.itemKind !== b.itemKind) return a.itemKind < b.itemKind ? -1 : 1
    return a.itemName < b.itemName ? -1 : 1
  })

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
    inventory: filtered,
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
