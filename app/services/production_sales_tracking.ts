import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

type RecordOutputInput = {
  jobId: number
  productId: number
  machineId: number | null
  producedQty: number
  unitCost: number
  producedAt: DateTime
  trx: TransactionClientContract
}

/** Records only newly completed production. Existing stock is intentionally unattributed. */
export async function recordProductionOutput(input: RecordOutputInput) {
  await input.trx
    .table('production_outputs')
    .insert({
      job_id: input.jobId,
      product_id: input.productId,
      machine_id: input.machineId,
      produced_qty: input.producedQty,
      available_qty: input.producedQty,
      unit_cost: input.unitCost,
      produced_at: input.producedAt.toJSDate(),
      created_at: DateTime.now().toJSDate(),
      updated_at: DateTime.now().toJSDate(),
    })
    .onConflict('job_id')
    .ignore()
}

/** Allocates a confirmed sale to the oldest tracked production first. */
export async function allocateSaleToProduction(input: {
  orderItemId: number
  productId: number
  qty: number
  unitSalePrice: number
  trx: TransactionClientContract
}) {
  let remaining = input.qty
  const outputs = await input.trx
    .from('production_outputs')
    .where('product_id', input.productId)
    .where('available_qty', '>', 0)
    .orderBy('produced_at', 'asc')
    .orderBy('id', 'asc')
    .forUpdate()

  for (const output of outputs) {
    if (remaining <= 0) break
    const allocated = Math.min(remaining, Number(output.available_qty))
    if (allocated <= 0) continue
    await input.trx.table('order_item_production_allocations').insert({
      order_item_id: input.orderItemId,
      production_output_id: output.id,
      qty: allocated,
      returned_qty: 0,
      unit_sale_price: input.unitSalePrice,
      unit_cost: output.unit_cost,
      created_at: DateTime.now().toSQL(),
      updated_at: DateTime.now().toSQL(),
    })
    await input.trx
      .from('production_outputs')
      .where('id', output.id)
      .update({
        available_qty: Number(output.available_qty) - allocated,
        updated_at: DateTime.now().toSQL(),
      })
    remaining -= allocated
  }
}

/** Restores the exact tracked production allocations when sold goods are returned. */
export async function restoreReturnedProduction(input: {
  orderItemId: number
  qty: number
  trx: TransactionClientContract
}) {
  let remaining = input.qty
  const allocations = await input.trx
    .from('order_item_production_allocations')
    .where('order_item_id', input.orderItemId)
    .whereRaw('returned_qty < qty')
    .orderBy('id', 'desc')
    .forUpdate()

  for (const allocation of allocations) {
    if (remaining <= 0) break
    const restorable = Number(allocation.qty) - Number(allocation.returned_qty)
    const restored = Math.min(remaining, restorable)
    if (restored <= 0) continue
    await input.trx
      .from('order_item_production_allocations')
      .where('id', allocation.id)
      .update({
        returned_qty: Number(allocation.returned_qty) + restored,
        updated_at: DateTime.now().toSQL(),
      })
    await input.trx
      .from('production_outputs')
      .where('id', allocation.production_output_id)
      .increment('available_qty', restored)
    remaining -= restored
  }
}
