import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import { selectEligibleJobIds } from '#services/job_auto_complete_scheduler'
import db from '@adonisjs/lucid/services/db'
import { setupJobFixture } from '#tests/helpers/job_fixtures'

test.group('scheduler eligibility', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('selects only in_progress jobs past auto_complete_at', async ({ assert }) => {
    const { job: jobOverdue, actor } = await setupJobFixture({ withRecipe: false })
    const { job: jobFuture } = await setupJobFixture({ withRecipe: false, actor })
    const { job: jobPaused } = await setupJobFixture({ withRecipe: false, actor })
    const { job: jobDone } = await setupJobFixture({ withRecipe: false, actor })

    const past = DateTime.now().minus({ minutes: 5 })
    const future = DateTime.now().plus({ minutes: 30 })

    jobOverdue.merge({ status: 'in_progress', autoCompleteAt: past })
    await jobOverdue.save()
    jobFuture.merge({ status: 'in_progress', autoCompleteAt: future })
    await jobFuture.save()
    jobPaused.merge({ status: 'paused', autoCompleteAt: null })
    await jobPaused.save()
    jobDone.merge({ status: 'completed', autoCompleteAt: past })
    await jobDone.save()

    const ids = await db.transaction((trx) => selectEligibleJobIds(trx, 100))
    assert.includeMembers(ids, [jobOverdue.id])
    assert.notInclude(ids, jobFuture.id)
    assert.notInclude(ids, jobPaused.id)
    assert.notInclude(ids, jobDone.id)
  })
})
