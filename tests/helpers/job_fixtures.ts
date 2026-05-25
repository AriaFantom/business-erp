import User from '#models/user'
import Product from '#models/product'
import Material from '#models/material'
import Inventory from '#models/inventory'
import ProductionJob from '#models/production_job'
import { nextDocNumber } from '#services/numbering'
import db from '@adonisjs/lucid/services/db'
import type { StartJobConsumptionInput } from '#services/job_costing'

export async function setupJobFixture(opts: {
  plannedQty?: number
  withRecipe?: boolean
  actor?: User
}): Promise<{
  job: ProductionJob
  product: Product
  actor: User
  material: Material
  consumption: StartJobConsumptionInput
}> {
  const actor =
    opts.actor ??
    (await User.create({
      email: `tester+${Date.now()}.${Math.random()}@example.com`,
      password: 'Passw0rd!',
      firstName: 'T',
      lastName: 'U',
    }))
  const product = await Product.create({
    sku: `SKU${Date.now()}${Math.floor(Math.random() * 1000)}`,
    name: 'Test product',
    isActive: true,
  } as any)
  const material = await Material.create({
    sku: `MAT${Date.now()}${Math.floor(Math.random() * 1000)}`,
    name: 'Test material',
    unit: 'kg',
    isActive: true,
  } as any)
  await Inventory.create({
    itemKind: 'material',
    itemId: material.id,
    qty: '1000',
    avgUnitCost: '1',
  } as any)
  const number = await db.transaction((trx) => nextDocNumber('JOB', trx))
  const job = await ProductionJob.create({
    number,
    productId: product.id,
    plannedQty: opts.plannedQty ?? 1,
    producedQty: 0,
    status: 'draft',
    totalMaterialCost: '0',
    totalComponentCost: '0',
    totalExpense: '0',
    totalCost: '0',
    unitCost: '0',
    createdByUserId: actor.id,
  } as any)
  return {
    job,
    product,
    actor,
    material,
    consumption: { itemKind: 'material', itemId: material.id, qtyConsumed: 1 },
  }
}
