import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Printer from '#models/printer'
import Expense from '#models/expense'
import User from '#models/user'
import { getPrintersIndexViewModel } from '#services/printers_view_models'

test.group('printers index view model', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('aggregates expense total per printer', async ({ assert }) => {
    const user = await User.create({
      email: `idx+${Date.now()}@example.com`,
      password: 'Passw0rd!',
      firstName: 'I',
      lastName: 'X',
    })
    const p = await Printer.create({ name: 'AGG-1', status: 'idle' })
    await Expense.create({
      printerId: p.id,
      jobId: null,
      kind: 'maintenance',
      description: 'fan',
      amount: '12.50',
      incurredAt: DateTime.now(),
      createdByUserId: user.id,
    } as any)
    await Expense.create({
      printerId: p.id,
      jobId: null,
      kind: 'parts',
      description: 'bearing',
      amount: '7.50',
      incurredAt: DateTime.now(),
      createdByUserId: user.id,
    } as any)

    const vm = await getPrintersIndexViewModel()
    const row = vm.printers.find((r) => r.id === p.id)
    assert.equal(row?.expenseTotal, '20')
  })
})
