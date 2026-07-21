import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import ProductionJob from '#models/production_job'
import ProductionJobStage from '#models/production_job_stage'
import Machine from '#models/machine'
import Worker from '#models/worker'
import JobWorker from '#models/job_worker'
import { cancelJob, completeJob, startJob } from '#services/job_costing'
import { DomainError, InvalidStateError } from '#services/domain_errors'
import { setupJobFixture } from '#tests/helpers/job_fixtures'

/**
 * Job cost from worker time is driven by completed stage durations, so tests
 * backdate the stage to simulate an hour of work before completing.
 */
async function runStageForMinutes(jobId: number, minutes: number) {
  const startedAt = DateTime.now().minus({ minutes })
  await ProductionJobStage.query().where('job_id', jobId).update({
    started_at: startedAt.toSQL(),
    completed_at: DateTime.now().toSQL(),
  })
}

async function makeWorker(attrs: Partial<Record<string, unknown>> = {}) {
  return Worker.create({
    name: `W${Date.now()}${Math.floor(Math.random() * 100000)}`,
    payType: 'hourly',
    hourlyRate: '100',
    monthlySalary: '0',
    standardMonthlyHours: 208,
    status: 'idle',
    ...attrs,
  } as never)
}

test.group('labour costing', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a job runs with workers and no machine, and their time lands in job cost', async ({
    assert,
  }) => {
    const { job, actor, consumption } = await setupJobFixture({ plannedQty: 1, withRecipe: false })
    const worker = await makeWorker({ hourlyRate: '100' })

    await startJob({
      jobId: job.id,
      machineId: null,
      workerIds: [worker.id],
      stages: [{ name: 'crochet', durationMinutes: 60 }],
      consumptions: [consumption],
      actor,
    })

    const busy = await Worker.findOrFail(worker.id)
    assert.equal(busy.status, 'working')
    assert.equal(busy.currentJobId, job.id)

    await runStageForMinutes(job.id, 60)
    await completeJob({ jobId: job.id, producedQty: 1, actor })

    const done = await ProductionJob.findOrFail(job.id)
    assert.equal(done.labourMinutes, 60)
    assert.equal(Number(done.totalLabourCost), 100)
    // Material (1 @ cost 1) + labour 100, and no machine cost.
    assert.equal(Number(done.totalMachineCost), 0)
    assert.equal(Number(done.totalCost), 101)
    assert.equal(Number(done.unitCost), 101)

    // The worker is released back to the pool.
    const freed = await Worker.findOrFail(worker.id)
    assert.equal(freed.status, 'idle')
    assert.isNull(freed.currentJobId)
    const assignment = await JobWorker.query().where('job_id', job.id).firstOrFail()
    assert.equal(assignment.minutesWorked, 60)
    assert.equal(Number(assignment.lineCost), 100)
    assert.isNotNull(assignment.releasedAt)
  })

  test('parallel workers each bill their own hours alongside the machine', async ({ assert }) => {
    const { job, actor, consumption } = await setupJobFixture({ plannedQty: 1, withRecipe: false })
    const machine = await Machine.create({
      name: `M${Date.now()}`,
      status: 'idle',
      hourlyRate: '50',
    } as never)
    const a = await makeWorker({ hourlyRate: '100' })
    const b = await makeWorker({ hourlyRate: '60' })

    await startJob({
      jobId: job.id,
      machineId: machine.id,
      workerIds: [a.id, b.id],
      stages: [{ name: 'sew', durationMinutes: 60 }],
      consumptions: [consumption],
      actor,
    })

    await runStageForMinutes(job.id, 60)
    await completeJob({ jobId: job.id, producedQty: 1, actor })

    const done = await ProductionJob.findOrFail(job.id)
    // Two people for an hour = two billed hours: 100 + 60.
    assert.equal(done.labourMinutes, 120)
    assert.equal(Number(done.totalLabourCost), 160)
    assert.equal(Number(done.totalMachineCost), 50)
    // material 1 + machine 50 + labour 160
    assert.equal(Number(done.totalCost), 211)

    const freedMachine = await Machine.findOrFail(machine.id)
    assert.equal(freedMachine.status, 'idle')
  })

  test('a monthly worker bills the rate derived from their salary', async ({ assert }) => {
    const { job, actor, consumption } = await setupJobFixture({ plannedQty: 1, withRecipe: false })
    const worker = await makeWorker({
      payType: 'monthly',
      hourlyRate: '0',
      monthlySalary: '20800',
      standardMonthlyHours: 208,
    })

    await startJob({
      jobId: job.id,
      machineId: null,
      workerIds: [worker.id],
      stages: [{ name: 'assemble', durationMinutes: 60 }],
      consumptions: [consumption],
      actor,
    })
    await runStageForMinutes(job.id, 60)
    await completeJob({ jobId: job.id, producedQty: 1, actor })

    const done = await ProductionJob.findOrFail(job.id)
    // 20800 / 208 = 100 per hour.
    assert.equal(Number(done.totalLabourCost), 100)
  })

  test('confirming a job early still bills the time worked so far', async ({ assert }) => {
    const { job, actor, consumption } = await setupJobFixture({ plannedQty: 1, withRecipe: false })
    const worker = await makeWorker({ hourlyRate: '120' })

    await startJob({
      jobId: job.id,
      machineId: null,
      workerIds: [worker.id],
      stages: [{ name: 'crochet', durationMinutes: 600 }],
      consumptions: [consumption],
      actor,
    })

    // Only backdate the start: the stage is still in_progress, exactly as it is
    // when an operator confirms before the timer runs out.
    await ProductionJobStage.query()
      .where('job_id', job.id)
      .update({ started_at: DateTime.now().minus({ minutes: 60 }).toSQL() })

    await completeJob({ jobId: job.id, producedQty: 1, actor })

    const done = await ProductionJob.findOrFail(job.id)
    assert.equal(done.labourMinutes, 60, 'an open stage must still be counted')
    assert.equal(Number(done.totalLabourCost), 120)

    const stage = await ProductionJobStage.query().where('job_id', job.id).firstOrFail()
    assert.equal(stage.status, 'completed')
    assert.isNotNull(stage.completedAt)
  })

  test('starting with neither a machine nor a worker is rejected', async ({ assert }) => {
    const { job, actor, consumption } = await setupJobFixture({ plannedQty: 1, withRecipe: false })
    await assert.rejects(
      () =>
        startJob({
          jobId: job.id,
          machineId: null,
          workerIds: [],
          stages: [{ name: 's', durationMinutes: 10 }],
          consumptions: [consumption],
          actor,
        }),
      DomainError
    )
    const untouched = await ProductionJob.findOrFail(job.id)
    assert.equal(untouched.status, 'draft')
  })

  test('a worker already on another job cannot be assigned', async ({ assert }) => {
    const first = await setupJobFixture({ plannedQty: 1, withRecipe: false })
    const worker = await makeWorker()
    await startJob({
      jobId: first.job.id,
      machineId: null,
      workerIds: [worker.id],
      stages: [{ name: 's', durationMinutes: 30 }],
      consumptions: [first.consumption],
      actor: first.actor,
    })

    const second = await setupJobFixture({ plannedQty: 1, withRecipe: false, actor: first.actor })
    await assert.rejects(
      () =>
        startJob({
          jobId: second.job.id,
          machineId: null,
          workerIds: [worker.id],
          stages: [{ name: 's', durationMinutes: 30 }],
          consumptions: [second.consumption],
          actor: second.actor,
        }),
      InvalidStateError
    )
  })

  test('cancelling a job releases its workers', async ({ assert }) => {
    const { job, actor, consumption } = await setupJobFixture({ plannedQty: 1, withRecipe: false })
    const worker = await makeWorker()
    await startJob({
      jobId: job.id,
      machineId: null,
      workerIds: [worker.id],
      stages: [{ name: 's', durationMinutes: 30 }],
      consumptions: [consumption],
      actor,
    })

    await cancelJob(job.id, actor)

    const freed = await Worker.findOrFail(worker.id)
    assert.equal(freed.status, 'idle')
    assert.isNull(freed.currentJobId)
  })
})
