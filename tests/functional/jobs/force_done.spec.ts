import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Inventory from '#models/inventory'
import JobMaterialConsumption from '#models/job_material_consumption'
import Machine from '#models/machine'
import ProductionJob from '#models/production_job'
import ProductionJobStage from '#models/production_job_stage'
import StockMovement from '#models/stock_movement'
import { forceDoneJob, pauseJob, startJob } from '#services/job_costing'
import { tick } from '#services/job_auto_complete_scheduler'
import { InvalidStateError } from '#services/domain_errors'
import { setupJobFixture } from '#tests/helpers/job_fixtures'
import { DateTime } from 'luxon'

test.group('Force done jobs', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('completes a draft atomically with converted consumption and configured costing', async ({
    assert,
  }) => {
    const { job, actor, material, product } = await setupJobFixture({ plannedQty: 2 })
    const machine = await Machine.create({
      name: `Force ${Date.now()}`,
      status: 'idle',
      hourlyRate: '60',
    })

    await forceDoneJob({
      jobId: job.id,
      producedQty: 2,
      machineId: machine.id,
      stages: [
        { name: 'Prepare', durationMinutes: 30 },
        { name: 'Finish', durationMinutes: 90 },
      ],
      consumptions: [
        { itemKind: 'material', itemId: material.id, qtyConsumed: 500, unit: 'g' },
        { itemKind: 'material', itemId: material.id, qtyConsumed: 0.5, unit: 'kg' },
      ],
      actor,
    })

    const done = await ProductionJob.findOrFail(job.id)
    assert.equal(done.status, 'completed')
    assert.equal(done.completionTimeBasis, 'forced_configured')
    assert.equal(done.machineMinutes, 120)
    assert.equal(Number(done.totalMachineCost), 120)

    const consumption = await JobMaterialConsumption.query().where('job_id', job.id).firstOrFail()
    assert.equal(consumption.qtyConsumed, '1.000000000')
    const materialStock = await Inventory.query()
      .where('item_kind', 'material')
      .where('item_id', material.id)
      .firstOrFail()
    assert.equal(materialStock.qty, '999.000000000')
    const productStock = await Inventory.query()
      .where('item_kind', 'product')
      .where('item_id', product.id)
      .firstOrFail()
    assert.equal(productStock.qty, '2.000000000')

    const stages = await ProductionJobStage.query().where('job_id', job.id).orderBy('sequence')
    assert.deepEqual(
      stages.map((stage) => stage.status),
      ['completed', 'completed']
    )
    await machine.refresh()
    assert.equal(machine.status, 'idle')
  })

  test('force completing an active job never consumes its inputs twice', async ({ assert }) => {
    const { job, actor, consumption, material } = await setupJobFixture({ plannedQty: 1 })
    const machine = await Machine.create({
      name: `Active ${Date.now()}`,
      status: 'idle',
      hourlyRate: '60',
    })
    await startJob({
      jobId: job.id,
      machineId: machine.id,
      stages: [{ name: 'Run', durationMinutes: 60 }],
      consumptions: [consumption],
      actor,
    })

    await forceDoneJob({ jobId: job.id, producedQty: 1, actor })
    const consumeMovements = await StockMovement.query()
      .where('reference_type', 'job')
      .where('reference_id', job.id)
      .where('reason', 'job_consume')
    assert.lengthOf(consumeMovements, 1)
    const stock = await Inventory.query()
      .where('item_kind', 'material')
      .where('item_id', material.id)
      .firstOrFail()
    assert.equal(stock.qty, '999.000000000')

    await assert.rejects(
      () => forceDoneJob({ jobId: job.id, producedQty: 1, actor }),
      InvalidStateError
    )
    assert.lengthOf(
      await StockMovement.query()
        .where('reference_type', 'job')
        .where('reference_id', job.id)
        .where('reason', 'job_produce'),
      1
    )
  })

  test('supports paused and awaiting-confirmation jobs', async ({ assert }) => {
    const pausedFixture = await setupJobFixture({ plannedQty: 1 })
    const pausedMachine = await Machine.create({
      name: `Paused ${Date.now()}`,
      status: 'idle',
      hourlyRate: '60',
    })
    await startJob({
      jobId: pausedFixture.job.id,
      machineId: pausedMachine.id,
      stages: [{ name: 'Paused stage', durationMinutes: 45 }],
      consumptions: [pausedFixture.consumption],
      actor: pausedFixture.actor,
    })
    await pauseJob(pausedFixture.job.id, pausedFixture.actor)
    await forceDoneJob({
      jobId: pausedFixture.job.id,
      producedQty: 1,
      actor: pausedFixture.actor,
    })
    const pausedDone = await ProductionJob.findOrFail(pausedFixture.job.id)
    assert.equal(pausedDone.status, 'completed')
    assert.equal(pausedDone.machineMinutes, 45)
    assert.isNull(pausedDone.pausedAt)
    assert.isNull(pausedDone.remainingSeconds)

    const awaitingFixture = await setupJobFixture({ plannedQty: 1, actor: pausedFixture.actor })
    const awaitingMachine = await Machine.create({
      name: `Awaiting ${Date.now()}`,
      status: 'idle',
      hourlyRate: '60',
    })
    await startJob({
      jobId: awaitingFixture.job.id,
      machineId: awaitingMachine.id,
      stages: [{ name: 'Awaiting stage', durationMinutes: 20 }],
      consumptions: [awaitingFixture.consumption],
      actor: awaitingFixture.actor,
    })
    const past = DateTime.now().minus({ minutes: 1 }).toSQL()
    await ProductionJob.query()
      .where('id', awaitingFixture.job.id)
      .update({ auto_complete_at: past })
    await ProductionJobStage.query()
      .where('job_id', awaitingFixture.job.id)
      .update({ auto_complete_at: past })
    await tick()
    const awaiting = await ProductionJob.findOrFail(awaitingFixture.job.id)
    assert.equal(awaiting.status, 'awaiting_confirmation')

    await forceDoneJob({
      jobId: awaitingFixture.job.id,
      producedQty: 1,
      actor: awaitingFixture.actor,
    })
    const awaitingDone = await ProductionJob.findOrFail(awaitingFixture.job.id)
    assert.equal(awaitingDone.status, 'completed')
    assert.equal(awaitingDone.machineMinutes, 20)
  })
})
