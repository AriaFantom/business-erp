import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Printer from '#models/printer'
import ProductionJob from '#models/production_job'
import { pauseJob, resumeJob, startJob } from '#services/job_costing'
import { setupJobFixture } from '#tests/helpers/job_fixtures'

test.group('pauseJob / resumeJob', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('pause clears auto_complete_at, sets remaining_seconds', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ withRecipe: false })
    const printer = await Printer.create({ name: 'P1', status: 'idle' })
    await startJob({
      jobId: job.id,
      printerId: printer.id,
      stages: [{ name: 's', durationMinutes: 60 }],
      actor,
    })
    await pauseJob(job.id, actor)
    const j = await ProductionJob.findOrFail(job.id)
    assert.equal(j.status, 'paused')
    assert.isNull(j.autoCompleteAt)
    assert.isAtLeast(j.remainingSeconds ?? 0, 60 * 59) // within rounding tolerance
    assert.isAtMost(j.remainingSeconds ?? 0, 60 * 60)
    assert.isNotNull(j.pausedAt)
  })

  test('resume restores auto_complete_at = now + remaining_seconds', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ withRecipe: false })
    const printer = await Printer.create({ name: 'P2', status: 'idle' })
    await startJob({
      jobId: job.id,
      printerId: printer.id,
      stages: [{ name: 's', durationMinutes: 60 }],
      actor,
    })
    await pauseJob(job.id, actor)
    await resumeJob(job.id, actor)
    const j = await ProductionJob.findOrFail(job.id)
    assert.equal(j.status, 'in_progress')
    assert.isNull(j.pausedAt)
    assert.isNull(j.remainingSeconds)
    assert.isNotNull(j.autoCompleteAt)
  })

  test('pause rejects non-in-progress jobs', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ withRecipe: false })
    await assert.rejects(() => pauseJob(job.id, actor))
  })
})
