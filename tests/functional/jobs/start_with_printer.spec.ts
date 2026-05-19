import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Printer from '#models/printer'
import ProductionJob from '#models/production_job'
import ProductionJobStage from '#models/production_job_stage'
import { startJob } from '#services/job_costing'
import { setupJobFixture } from '#tests/helpers/job_fixtures'

test.group('startJob with printer', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('assigns printer, stages, and timer; flips printer to printing', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ plannedQty: 1, withRecipe: false })
    const printer = await Printer.create({ name: 'A1', status: 'idle' })

    await startJob({
      jobId: job.id,
      printerId: printer.id,
      stages: [
        { name: 'Layer 1', durationMinutes: 30 },
        { name: 'Layer 2', durationMinutes: 60 },
      ],
      actor,
    })

    const reloaded = await ProductionJob.findOrFail(job.id)
    assert.equal(reloaded.status, 'in_progress')
    assert.equal(reloaded.printerId, printer.id)
    assert.equal(reloaded.estimatedDurationMin, 30)
    assert.isNotNull(reloaded.autoCompleteAt)
    assert.isNotNull(reloaded.currentStageId)

    const stages = await ProductionJobStage.query().where('job_id', job.id).orderBy('sequence')
    assert.lengthOf(stages, 2)
    assert.equal(stages[0].status, 'in_progress')
    assert.equal(stages[1].status, 'pending')

    const printerR = await Printer.findOrFail(printer.id)
    assert.equal(printerR.status, 'printing')
    assert.equal(printerR.currentJobId, job.id)
  })

  test('rejects starting when printer is not idle', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ withRecipe: false })
    const printer = await Printer.create({ name: 'A2', status: 'printing' })
    await assert.rejects(() =>
      startJob({
        jobId: job.id,
        printerId: printer.id,
        stages: [{ name: 's', durationMinutes: 10 }],
        actor,
      })
    )
  })

  test('two concurrent starts on the same printer cannot both succeed', async ({ assert }) => {
    // Create two draft jobs and one idle printer; run startJob twice
    // concurrently and assert exactly one resolves while the other rejects
    // (DB unique-index violation translated into a DomainError).
    const { job: jobA, actor } = await setupJobFixture({ withRecipe: false })
    const { job: jobB } = await setupJobFixture({ withRecipe: false, actor })
    const printer = await Printer.create({ name: 'A3', status: 'idle' })

    const args = (id: number) => ({
      jobId: id,
      printerId: printer.id,
      stages: [{ name: 's', durationMinutes: 10 }],
      actor,
    })
    const results = await Promise.allSettled([startJob(args(jobA.id)), startJob(args(jobB.id))])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')
    assert.lengthOf(fulfilled, 1)
    assert.lengthOf(rejected, 1)
  })
})
