import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import Role from '#models/role'
import Worker from '#models/worker'
import WorkerPayment from '#models/worker_payment'
import { invalidateEnabledModulesCache, setEnabledModules } from '#services/modules/module_service'
import { MODULE_KEYS } from '#services/modules/registry'

const WORKER_PERMS = [
  'workers.view',
  'workers.create',
  'workers.update',
  'workers.retire',
  'workers.pay',
  'settings.manageModules',
]

/**
 * A user holding every worker permission. Bouncer resolves permissions from
 * roles (isOwner is not a shortcut), so the role has to carry them explicitly.
 */
async function makeManager(tag: string): Promise<User> {
  const role = await Role.create({
    name: `t_wrk_${Date.now()}_${Math.floor(Math.random() * 99999)}`,
    displayName: 'Test Workers Role',
    isSystem: false,
    parentRoleId: null,
  })
  await role.syncPermissions(WORKER_PERMS)
  const user = await User.create({
    email: `${tag}+${Date.now()}.${Math.random()}@test.com`,
    password: 'Passw0rd!',
    firstName: 'O',
    lastName: 'W',
    isOwner: false,
  })
  await user.related('roles').attach([role.id])
  return user
}

test.group('Workers', (group) => {
  group.each.setup(async () => {
    await invalidateEnabledModulesCache()
    return testUtils.db().withGlobalTransaction()
  })
  group.each.teardown(() => invalidateEnabledModulesCache())

  test('a manager can create an hourly worker', async ({ client, assert }) => {
    const manager = await makeManager('create')
    const res = await client
      .post('/workers')
      .loginAs(manager)
      .withCsrfToken()
      .redirects(0)
      .json({ name: 'Asha', payType: 'hourly', hourlyRate: 120 })
    res.assertStatus(302)

    const worker = await Worker.findByOrFail('name', 'Asha')
    assert.equal(worker.payType, 'hourly')
    assert.equal(Number(worker.hourlyRate), 120)
    assert.equal(worker.status, 'idle')
  })

  test('a duplicate worker name is refused', async ({ client, assert }) => {
    const manager = await makeManager('dup')
    await Worker.create({
      name: 'Ravi',
      payType: 'hourly',
      hourlyRate: '100',
      monthlySalary: '0',
      standardMonthlyHours: 208,
      status: 'idle',
    } as never)

    await client
      .post('/workers')
      .loginAs(manager)
      .withCsrfToken()
      .redirects(0)
      .json({ name: 'Ravi', payType: 'hourly', hourlyRate: 50 })

    const all = await Worker.query().where('name', 'Ravi')
    assert.lengthOf(all, 1)
    assert.equal(Number(all[0].hourlyRate), 100, 'the original record must be untouched')
  })

  test('a payment is recorded against the worker', async ({ client, assert }) => {
    const manager = await makeManager('pay')
    const worker = await Worker.create({
      name: `Paid${Date.now()}`,
      payType: 'monthly',
      hourlyRate: '0',
      monthlySalary: '20800',
      standardMonthlyHours: 208,
      status: 'idle',
    } as never)

    const res = await client
      .post(`/workers/${worker.id}/payments`)
      .loginAs(manager)
      .withCsrfToken()
      .redirects(0)
      .json({ amount: 20800, kind: 'salary' })
    res.assertStatus(302)

    const payments = await WorkerPayment.query().where('worker_id', worker.id)
    assert.lengthOf(payments, 1)
    assert.equal(Number(payments[0].amount), 20800)
    assert.equal(payments[0].kind, 'salary')
  })

  test('a zero-amount payment is rejected', async ({ client, assert }) => {
    const manager = await makeManager('zero')
    const worker = await Worker.create({
      name: `Zero${Date.now()}`,
      payType: 'hourly',
      hourlyRate: '100',
      monthlySalary: '0',
      standardMonthlyHours: 208,
      status: 'idle',
    } as never)

    await client
      .post(`/workers/${worker.id}/payments`)
      .loginAs(manager)
      .withCsrfToken()
      .redirects(0)
      .json({ amount: 0, kind: 'wages' })

    const payments = await WorkerPayment.query().where('worker_id', worker.id)
    assert.lengthOf(payments, 0)
  })

  test('a worker on a job cannot be deactivated', async ({ client, assert }) => {
    const manager = await makeManager('busy')
    const worker = await Worker.create({
      name: `Busy${Date.now()}`,
      payType: 'hourly',
      hourlyRate: '100',
      monthlySalary: '0',
      standardMonthlyHours: 208,
      status: 'working',
    } as never)

    await client
      .post(`/workers/${worker.id}/retire`)
      .loginAs(manager)
      .withCsrfToken()
      .redirects(0)
      .json({})

    const after = await Worker.findOrFail(worker.id)
    assert.equal(after.status, 'working')
  })

  test('the workers page is reachable while the labour module is on', async ({ client }) => {
    const manager = await makeManager('on')
    await setEnabledModules([...MODULE_KEYS], manager)
    const res = await client.get('/workers').loginAs(manager)
    res.assertStatus(200)
  })

  test('disabling the labour module gates the worker routes', async ({ client, assert }) => {
    const manager = await makeManager('off')
    await setEnabledModules(
      MODULE_KEYS.filter((k) => k !== 'labour'),
      manager
    )

    const getRes = await client.get('/workers').loginAs(manager).redirects(0)
    getRes.assertStatus(302)
    assert.equal(getRes.header('location'), '/dashboard')

    const postRes = await client
      .post('/workers')
      .loginAs(manager)
      .withCsrfToken()
      .redirects(0)
      .json({ name: 'Ghost', payType: 'hourly' })
    postRes.assertStatus(404)

    const created = await Worker.query().where('name', 'Ghost')
    assert.lengthOf(created, 0)
  })
})
