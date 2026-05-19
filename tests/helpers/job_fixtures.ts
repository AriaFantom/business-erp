import User from '#models/user'
import Product from '#models/product'
import ProductionJob from '#models/production_job'
import { nextDocNumber } from '#services/numbering'
import db from '@adonisjs/lucid/services/db'

export async function setupJobFixture(opts: {
  plannedQty?: number
  withRecipe?: boolean
  actor?: User
}): Promise<{ job: ProductionJob; product: Product; actor: User }> {
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
  return { job, product, actor }
}
