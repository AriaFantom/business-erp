import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Printer from '#models/printer'
import ProductionJob from '#models/production_job'
import { recordExpense } from '#services/job_costing'
import { setupJobFixture } from '#tests/helpers/job_fixtures'

test.group('expenses', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('printer-only expense does not change job totals', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ withRecipe: false })
    const printer = await Printer.create({ name: 'E1', status: 'idle' })
    const before = await ProductionJob.findOrFail(job.id)
    const beforeTotal = before.totalExpense

    await recordExpense({
      printerId: printer.id,
      kind: 'maintenance',
      description: 'Replaced hotend',
      amount: 35,
      actor,
    })
    const after = await ProductionJob.findOrFail(job.id)
    const afterTotal = after.totalExpense
    assert.equal(beforeTotal, afterTotal)
  })

  test('rejects expense with neither job nor printer', async ({ assert }) => {
    const { actor } = await setupJobFixture({ withRecipe: false })
    await assert.rejects(() => recordExpense({ kind: 'other', description: 'x', amount: 1, actor }))
  })
})
