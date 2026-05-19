import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Printer from '#models/printer'
import ProductionJob from '#models/production_job'
import { confirmJob, startJob } from '#services/job_costing'
import { setupJobFixture } from '#tests/helpers/job_fixtures'

test.group('confirmJob', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('confirm from awaiting_confirmation completes job and frees printer', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ plannedQty: 1, withRecipe: false })
    const printer = await Printer.create({ name: 'C1', status: 'idle' })
    await startJob({
      jobId: job.id,
      printerId: printer.id,
      stages: [{ name: 's', durationMinutes: 1 }],
      actor,
    })
    await ProductionJob.query()
      .where('id', job.id)
      .update({ status: 'awaiting_confirmation', auto_complete_at: null, current_stage_id: null })

    await confirmJob({ jobId: job.id, producedQty: 1, actor })

    const j = await ProductionJob.findOrFail(job.id)
    assert.equal(j.status, 'completed')
    assert.equal(j.producedQty, 1)
    const p = await Printer.findOrFail(printer.id)
    assert.equal(p.status, 'idle')
    assert.isNull(p.currentJobId)
  })

  test('producedQty=0 routes to failJob', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ withRecipe: false })
    const printer = await Printer.create({ name: 'C2', status: 'idle' })
    await startJob({
      jobId: job.id,
      printerId: printer.id,
      stages: [{ name: 's', durationMinutes: 1 }],
      actor,
    })
    await ProductionJob.query()
      .where('id', job.id)
      .update({ status: 'awaiting_confirmation', auto_complete_at: null, current_stage_id: null })

    await confirmJob({ jobId: job.id, producedQty: 0, actor })

    const j = await ProductionJob.findOrFail(job.id)
    assert.equal(j.status, 'failed')
    const p = await Printer.findOrFail(printer.id)
    assert.equal(p.status, 'idle')
  })
})
