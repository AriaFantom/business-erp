import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Machine from '#models/machine'
import Expense from '#models/expense'
import User from '#models/user'
import { getMachinesIndexViewModel } from '#services/machines_view_models'

test.group('machines index view model', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('aggregates expense total per machine', async ({ assert }) => {
    const user = await User.create({
      email: `idx+${Date.now()}@example.com`,
      password: 'Passw0rd!',
      firstName: 'I',
      lastName: 'X',
    })
    const m = await Machine.create({ name: 'AGG-1', status: 'idle' })
    await Expense.create({
      machineId: m.id,
      jobId: null,
      kind: 'maintenance',
      description: 'fan',
      amount: '12.50',
      incurredAt: DateTime.now(),
      createdByUserId: user.id,
    } as any)
    await Expense.create({
      machineId: m.id,
      jobId: null,
      kind: 'parts',
      description: 'bearing',
      amount: '7.50',
      incurredAt: DateTime.now(),
      createdByUserId: user.id,
    } as any)

    const vm = await getMachinesIndexViewModel()
    const row = vm.machines.find((r) => r.id === m.id)
    assert.equal(row?.expenseTotal, '20')
  })
})
