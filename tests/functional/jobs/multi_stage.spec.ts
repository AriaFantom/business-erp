import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import ProductionJob from '#models/production_job'
import ProductionJobStage from '#models/production_job_stage'
import Machine from '#models/machine'
import { skipStage, startJob } from '#services/job_costing'
import { tick } from '#services/job_auto_complete_scheduler'
import { setupJobFixture } from '#tests/helpers/job_fixtures'

test.group('multi-stage job advancement', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('scheduler walks through three stages then awaits confirmation', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ withRecipe: false })
    const machine = await Machine.create({ name: 'M1', status: 'idle' })
    await startJob({
      jobId: job.id,
      machineId: machine.id,
      stages: [
        { name: '1', durationMinutes: 1 },
        { name: '2', durationMinutes: 1 },
        { name: '3', durationMinutes: 1 },
      ],
      actor,
    })

    for (let i = 0; i < 3; i++) {
      await ProductionJob.query()
        .where('id', job.id)
        .update({ auto_complete_at: DateTime.now().minus({ minutes: 1 }).toSQL() })
      await tick()
    }

    const j = await ProductionJob.findOrFail(job.id)
    assert.equal(j.status, 'awaiting_confirmation')
    const stages = await ProductionJobStage.query()
      .where('job_id', job.id)
      .orderBy('sequence', 'asc')
    assert.deepEqual(
      stages.map((s) => s.status),
      ['completed', 'completed', 'completed']
    )
  })

  test('skipStage advances mid-job', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ withRecipe: false })
    const machine = await Machine.create({ name: 'M2', status: 'idle' })
    await startJob({
      jobId: job.id,
      machineId: machine.id,
      stages: [
        { name: '1', durationMinutes: 60 },
        { name: '2', durationMinutes: 60 },
      ],
      actor,
    })
    await skipStage(job.id, actor)
    const stages = await ProductionJobStage.query()
      .where('job_id', job.id)
      .orderBy('sequence', 'asc')
    assert.equal(stages[0].status, 'skipped')
    assert.equal(stages[1].status, 'in_progress')
  })
})
