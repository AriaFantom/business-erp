import ProductionJob from '#models/production_job'
import JobMaterialConsumption from '#models/job_material_consumption'
import JobExpense from '#models/job_expense'
import Product from '#models/product'
import Material from '#models/material'
import Component from '#models/component'
import Inventory from '#models/inventory'
import { totalChainCost } from '#services/job_costing'

export async function getJobsIndexViewModel() {
  const [jobs, products] = await Promise.all([
    ProductionJob.query().orderBy('created_at', 'desc').limit(200),
    Product.query().where('is_active', true).orderBy('name', 'asc'),
  ])
  const productById = new Map(products.map((p) => [p.id, p]))

  return {
    jobs: jobs.map((j) => ({
      id: j.id,
      number: j.number,
      productId: j.productId,
      productName: productById.get(j.productId)?.name ?? '—',
      status: j.status,
      plannedQty: j.plannedQty,
      producedQty: j.producedQty,
      totalCost: j.totalCost,
      unitCost: j.unitCost,
      parentJobId: j.parentJobId,
      createdAt: j.createdAt.toISO(),
    })),
    products: products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
    })),
  }
}

export async function getJobShowViewModel(jobId: number) {
  const job = await ProductionJob.findOrFail(jobId)
  const [product, consumptions, expenses, materials, components, inventory] = await Promise.all([
    Product.find(job.productId),
    JobMaterialConsumption.query().where('job_id', jobId).orderBy('created_at', 'asc'),
    JobExpense.query().where('job_id', jobId).orderBy('incurred_at', 'asc'),
    Material.query().where('is_active', true).orderBy('name', 'asc'),
    Component.query().where('is_active', true).orderBy('name', 'asc'),
    Inventory.query(),
  ])

  const matById = new Map(materials.map((m) => [m.id, m]))
  const compById = new Map(components.map((c) => [c.id, c]))
  const invByKey = new Map(inventory.map((i) => [`${i.itemKind}:${i.itemId}`, i] as const))

  const chainCost = await totalChainCost(jobId)

  return {
    job: {
      id: job.id,
      number: job.number,
      status: job.status,
      productId: job.productId,
      productName: product?.name ?? '—',
      plannedQty: job.plannedQty,
      producedQty: job.producedQty,
      parentJobId: job.parentJobId,
      startedAt: job.startedAt?.toISO() ?? null,
      completedAt: job.completedAt?.toISO() ?? null,
      totalMaterialCost: job.totalMaterialCost,
      totalComponentCost: job.totalComponentCost,
      totalExpense: job.totalExpense,
      totalCost: job.totalCost,
      unitCost: job.unitCost,
      chainCost: String(chainCost),
      note: job.note,
    },
    consumptions: consumptions.map((c) => {
      const item = c.itemKind === 'material' ? matById.get(c.itemId) : compById.get(c.itemId)
      return {
        id: c.id,
        itemKind: c.itemKind,
        itemId: c.itemId,
        itemName: item?.name ?? '—',
        itemSku: item?.sku ?? '—',
        qtyConsumed: c.qtyConsumed,
        qtyWasted: c.qtyWasted,
        unitCostAtConsume: c.unitCostAtConsume,
        lineCost: c.lineCost,
        reason: c.reason,
        createdAt: c.createdAt.toISO(),
      }
    }),
    expenses: expenses.map((e) => ({
      id: e.id,
      kind: e.kind,
      description: e.description,
      amount: e.amount,
      incurredAt: e.incurredAt.toISO(),
    })),
    inventoryItems: [
      ...materials.map((m) => ({
        itemKind: 'material' as const,
        itemId: m.id,
        sku: m.sku,
        name: m.name,
        unit: m.unit,
        onHand: invByKey.get(`material:${m.id}`)?.qty ?? '0',
      })),
      ...components.map((c) => ({
        itemKind: 'component' as const,
        itemId: c.id,
        sku: c.sku,
        name: c.name,
        unit: c.unit,
        onHand: invByKey.get(`component:${c.id}`)?.qty ?? '0',
      })),
    ],
  }
}
