import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Machine from '#models/machine'
import ProductionJob from '#models/production_job'
import ProductionJobStage from '#models/production_job_stage'
import { startJob } from '#services/job_costing'
import { setupJobFixture } from '#tests/helpers/job_fixtures'

test.group('startJob with machine', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('assigns machine, stages, and timer; flips machine to running', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ plannedQty: 1, withRecipe: false })
    const machine = await Machine.create({ name: 'A1', status: 'idle' })

    await startJob({
      jobId: job.id,
      machineId: machine.id,
      stages: [
        { name: 'Layer 1', durationMinutes: 30 },
        { name: 'Layer 2', durationMinutes: 60 },
      ],
      actor,
    })

    const reloaded = await ProductionJob.findOrFail(job.id)
    assert.equal(reloaded.status, 'in_progress')
    assert.equal(reloaded.machineId, machine.id)
    assert.equal(reloaded.estimatedDurationMin, 30)
    assert.isNotNull(reloaded.autoCompleteAt)
    assert.isNotNull(reloaded.currentStageId)

    const stages = await ProductionJobStage.query().where('job_id', job.id).orderBy('sequence')
    assert.lengthOf(stages, 2)
    assert.equal(stages[0].status, 'in_progress')
    assert.equal(stages[1].status, 'pending')

    const machineR = await Machine.findOrFail(machine.id)
    assert.equal(machineR.status, 'running')
    assert.equal(machineR.currentJobId, job.id)
  })

  test('rejects starting when machine is not idle', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ withRecipe: false })
    const machine = await Machine.create({ name: 'A2', status: 'running' })
    await assert.rejects(() =>
      startJob({
        jobId: job.id,
        machineId: machine.id,
        stages: [{ name: 's', durationMinutes: 10 }],
        actor,
      })
    )
  })

  test('two concurrent starts on the same machine cannot both succeed', async ({ assert }) => {
    const { job: jobA, actor } = await setupJobFixture({ withRecipe: false })
    const { job: jobB } = await setupJobFixture({ withRecipe: false, actor })
    const machine = await Machine.create({ name: 'A3', status: 'idle' })

    const args = (id: number) => ({
      jobId: id,
      machineId: machine.id,
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
