import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import ProductionJob from '#models/production_job'
import Machine from '#models/machine'
import { startJob } from '#services/job_costing'
import { tick } from '#services/job_auto_complete_scheduler'
import { setupJobFixture } from '#tests/helpers/job_fixtures'

test.group('scheduler auto-complete (single stage)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('moves in_progress past deadline to awaiting_confirmation', async ({ assert }) => {
    const { job, actor, consumption } = await setupJobFixture({ withRecipe: false })
    const machine = await Machine.create({ name: 'X1', status: 'idle' })
    await startJob({
      jobId: job.id,
      machineId: machine.id,
      stages: [{ name: 's', durationMinutes: 1 }],
      consumptions: [consumption],
      actor,
    })
    // Force the deadline into the past.
    await ProductionJob.query()
      .where('id', job.id)
      .update({ auto_complete_at: DateTime.now().minus({ minutes: 1 }).toSQL() })

    const advanced = await tick()
    assert.equal(advanced, 1)
    const j = await ProductionJob.findOrFail(job.id)
    assert.equal(j.status, 'awaiting_confirmation')
    assert.isNull(j.autoCompleteAt)
    assert.isNull(j.currentStageId)
  })

  test('ignores paused jobs', async ({ assert }) => {
    const { job, actor, consumption } = await setupJobFixture({ withRecipe: false })
    const machine = await Machine.create({ name: 'X2', status: 'idle' })
    await startJob({
      jobId: job.id,
      machineId: machine.id,
      stages: [{ name: 's', durationMinutes: 1 }],
      consumptions: [consumption],
      actor,
    })
    await ProductionJob.query().where('id', job.id).update({
      status: 'paused',
      auto_complete_at: null,
      paused_at: DateTime.now().toSQL(),
      remaining_seconds: 60,
    })
    const advanced = await tick()
    assert.equal(advanced, 0)
  })
})
