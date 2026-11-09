import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Customer from '#models/customer'
import Machine from '#models/machine'
import OrderItem from '#models/order_item'
import ProductionJob from '#models/production_job'
import { setupJobFixture } from '#tests/helpers/job_fixtures'
import { forceDoneJob } from '#services/job_costing'
import { confirmOrder, createOrder } from '#services/order_service'
import { createOrderReturn } from '#services/order_return_service'
import { getMachineShowViewModel } from '#services/machines_view_models'

test.group('machine production sales tracking', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('allocates oldest production and restores it on return', async ({ assert }) => {
    const { job, product, material, actor } = await setupJobFixture({ plannedQty: 2 })
    const machine = await Machine.create({
      name: `Tracked ${Date.now()}`,
      status: 'idle',
      hourlyRate: '0',
    })
    await forceDoneJob({
      jobId: job.id,
      producedQty: 2,
      machineId: machine.id,
      stages: [{ name: 'Make', durationMinutes: 10 }],
      consumptions: [{ itemKind: 'material', itemId: material.id, qtyConsumed: 2 }],
      actor,
    })
    const secondMachine = await Machine.create({
      name: `Tracked second ${Date.now()}`,
      status: 'idle',
      hourlyRate: '0',
    })
    const secondJob = await ProductionJob.create({
      number: `JOB-TRACK-${Date.now()}`,
      productId: product.id,
      plannedQty: 1,
      producedQty: 0,
      status: 'draft',
      totalMaterialCost: '0',
      totalComponentCost: '0',
      totalExpense: '0',
      totalCost: '0',
      unitCost: '0',
      createdByUserId: actor.id,
    } as Partial<ProductionJob>)
    await forceDoneJob({
      jobId: secondJob.id,
      producedQty: 1,
      machineId: secondMachine.id,
      stages: [{ name: 'Make', durationMinutes: 10 }],
      consumptions: [{ itemKind: 'material', itemId: material.id, qtyConsumed: 1 }],
      actor,
    })

    const customer = await Customer.create({ name: `Tracking ${Date.now()}`, isActive: true })
    const order = await createOrder({
      customerId: customer.id,
      items: [
        {
          productId: product.id,
          description: product.name,
          qty: 3,
          unitPrice: 10,
          taxRatePct: 0,
        },
      ],
      allowPriceOverride: true,
      actor,
    })
    await confirmOrder(order.id, actor)

    const orderItem = await OrderItem.query().where('order_id', order.id).firstOrFail()
    const allocations = await db
      .from('order_item_production_allocations')
      .where('order_item_id', orderItem.id)
      .orderBy('id')
    assert.deepEqual(
      allocations.map((allocation) => Number(allocation.qty)),
      [2, 1]
    )
    const output = await db.from('production_outputs').where('job_id', job.id).first()
    const secondOutput = await db.from('production_outputs').where('job_id', secondJob.id).first()
    assert.equal(Number(output?.available_qty), 0)
    assert.equal(Number(secondOutput?.available_qty), 0)

    const beforeReturn = await getMachineShowViewModel(machine.id)
    assert.equal(beforeReturn.machine.soldQty, 2)
    assert.equal(
      Number(beforeReturn.machine.salesProfit),
      2 * (Number(orderItem.unitPrice) - Number(allocations[0].unit_cost))
    )
    const secondBeforeReturn = await getMachineShowViewModel(secondMachine.id)
    assert.equal(secondBeforeReturn.machine.soldQty, 1)

    await createOrderReturn({
      orderId: order.id,
      items: [{ orderItemId: orderItem.id, qty: 1 }],
      actor,
    })
    const restored = await db.from('production_outputs').where('job_id', job.id).first()
    const secondRestored = await db.from('production_outputs').where('job_id', secondJob.id).first()
    const returnedAllocation = await db
      .from('order_item_production_allocations')
      .where('order_item_id', orderItem.id)
      .first()
    assert.equal(Number(restored?.available_qty), 0)
    assert.equal(Number(secondRestored?.available_qty), 1)
    assert.equal(Number(returnedAllocation?.returned_qty), 0)
    const returnedAllocations = await db
      .from('order_item_production_allocations')
      .where('order_item_id', orderItem.id)
      .orderBy('id')
    assert.deepEqual(
      returnedAllocations.map((allocation) => Number(allocation.returned_qty)),
      [0, 1]
    )
  })
})
